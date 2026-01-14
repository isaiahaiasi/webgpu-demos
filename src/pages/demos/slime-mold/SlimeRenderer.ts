import { BaseRenderer } from "../../../utils/BaseRenderer";

import renderShaderCode from "./shaders/render.wgsl?raw";
import computeShaderCode from "./shaders/compute.wgsl?raw";


type DirMethod = (pos?: [number, number]) => number;
type PosMethod = () => [number, number];

/*

CURRENT ISSUES:
- Buffer handling is crazy
- Missing GUI/Stats

*/

const TEXTURE_OPTIONS: GPUSamplerDescriptor = {
	addressModeU: "clamp-to-edge",
	addressModeV: "clamp-to-edge",
	magFilter: "linear",
	minFilter: "linear",
} as const;

/** Does not support multiple "views" */
class SimpleBufferAsset {
	buffer: GPUBuffer;
	values: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
	#device: GPUDevice;

	constructor(
		device: GPUDevice,
		initialArray: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>,
		descriptor: Omit<GPUBufferDescriptor, "size">,
	) {
		this.#device = device;
		this.values = initialArray;

		this.buffer = device.createBuffer({
			...descriptor,
			size: initialArray.byteLength,
		});

		this.set(initialArray);
	}

	set(value: ArrayLike<number>) {
		this.values.set(value);
		this.#device.queue.writeBuffer(this.buffer, 0, this.values);
	}
}


class AgentGenerator {
	cx: number;
	cy: number;
	w: number;
	h: number;

	pos = {
		center: () => [this.cx, this.cy],
		field: () => [Math.random() * this.w, Math.random() * this.h],
		subField: (pct = 3) => [
			(this.w / pct) + Math.random() * this.w * (pct - 2) / pct,
			(this.w / pct) + Math.random() * this.h * (pct - 2) / pct,
		],
		filledCircle: (radiusScale = .5) => {
			const r = this.cy * radiusScale * Math.random();
			const theta = Math.random() * Math.PI * 2;
			return [
				this.cx + r * Math.cos(theta),
				this.cy + r * Math.sin(theta),
			];
		}
	} satisfies Record<string, (num?: number) => [number, number]>;

	readonly dir = {
		random: () => Math.random() * Math.PI * 2,
		toCenter: (pos: [number, number]) =>
			Math.atan2(pos[1] - this.cy, pos[0] - this.cx) + Math.PI,
		fromCenter: (pos: [number, number]) =>
			Math.atan2(pos[1] - this.cy, pos[0] - this.cx),
	};

	constructor(texWidth: number, texHeight: number) {
		this.w = texWidth;
		this.h = texHeight;
		this.cx = texWidth / 2;
		this.cy = texHeight / 2;
	}


	createSpawnData(
		positionFn: PosMethod,
		directionFn: DirMethod,
	) {
		const pos = positionFn();
		return [
			...pos,
			directionFn(pos),
			0
		];
	}

	getAgents(
		numAgents: number,
		positionFn: PosMethod,
		directionFn: DirMethod,
	) {
		return new Array(numAgents)
			.fill(0)
			.map(() => this.createSpawnData(positionFn, directionFn))
			.flat();
	}
}

export class SlimeRenderer extends BaseRenderer {
	settings = {
		// reload required
		texWidth: 2048,
		texHeight: 1024,
		agentCounts: [1000, 100, 1] as [number, number, number], // vec3

		// currently requires reload but easily refactorable
		includeBg: true,

		// no reload
		evaporateSpeed: 1.4,
		evaporateWeight: [0.4, 0.2, 0.15, 1], // vec4
		diffuseSpeed: 50,
		moveSpeed: 80,
		sensorAngle: 25 * (Math.PI / 180), // radian angle of left/right sensors
		sensorDst: 10,
		sensorSize: 2, // square radius around sensor center
		turnSpeed: 20,
	};

	// ASSETS

	// Textures
	agentsTexture: GPUTexture;
	trailTexture: GPUTexture;
	bgTexture: GPUTexture;

	// Buffers (Storage & Uniform)
	agentsBuffer: SimpleBufferAsset;
	sceneInfoBuffer: SimpleBufferAsset;
	debugInputBuffer: SimpleBufferAsset;
	debugOutputBuffer: SimpleBufferAsset;
	simOptionsBuffer: {
		view: Record<string, Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>>,
		buffer: GPUBuffer,
		values: ArrayBuffer,
	};

	// BindGroup Layouts
	computeBindGroupLayout0: GPUBindGroupLayout;
	computeBindGroupLayout1: GPUBindGroupLayout;

	//BindGroups
	computeBindGroup0: GPUBindGroup;
	computeBindGroup1: GPUBindGroup;
	computeBindGroup2: GPUBindGroup;
	renderBindGroup: GPUBindGroup;

	//Pipelines
	computeUpdatePipeline: GPUComputePipeline;
	computeProcessPipeline: GPUComputePipeline;
	renderPipeline: GPURenderPipeline;


	get #totalAgentCount() {
		return this.settings.agentCounts.reduce((a, b) => a * b);
	}


	protected render(deltaTime: number): boolean {
		// NOTE: renderPassDescriptor doesn't need to be defined in the render loop,
		// I just didn't want to add another instance variable...
		const renderPassDescriptor = {
			label: "basic canvas renderPass",
			colorAttachments: [{
				// typescript doesn't let `view` be undefined,
				// even tho webgpufundamentals leaves it undefined until render()
				view: this.context.getCurrentTexture().createView(),
				clearValue: [0.3, 0.3, 0.3, 1],
				loadOp: "clear",
				storeOp: "store",
			}],
		} satisfies GPURenderPassDescriptor;

		this.sceneInfoBuffer.set([deltaTime, deltaTime]);

		// Update simOptions buffer by matching key in this.settings
		Object.entries(this.simOptionsBuffer.view).forEach(([key, view]) => {
			const value = this.settings[key];
			if (!value) {
				console.error(`${key} not defined in SlimeRenderer settings!`);
			}
			view.set(Array.isArray(value) ? value : [value]);
		});

		this.device.queue.writeBuffer(this.simOptionsBuffer.buffer, 0, this.simOptionsBuffer.values);


		const encoder = this.device.createCommandEncoder({ label: "slime mold::encoder" });

		let computePass = encoder.beginComputePass();
		computePass.setPipeline(this.computeUpdatePipeline);
		computePass.setBindGroup(0, this.computeBindGroup0);
		computePass.setBindGroup(1, this.computeBindGroup1);
		computePass.dispatchWorkgroups(...this.settings.agentCounts);
		computePass.end();

		computePass = encoder.beginComputePass();
		computePass.setPipeline(this.computeProcessPipeline);
		computePass.setBindGroup(0, this.computeBindGroup0);
		computePass.setBindGroup(1, this.computeBindGroup2);
		computePass.dispatchWorkgroups(this.settings.texWidth, this.settings.texHeight);
		computePass.end();


		renderPassDescriptor.colorAttachments[0].view =
			this.context.getCurrentTexture().createView();

		const renderPass = encoder.beginRenderPass(renderPassDescriptor);
		renderPass.setPipeline(this.renderPipeline);

		renderPass.setBindGroup(0, this.renderBindGroup);
		renderPass.draw(6);
		renderPass.end();


		encoder.copyBufferToBuffer(
			this.debugInputBuffer.buffer, 0,
			this.debugOutputBuffer.buffer, 0,
			this.debugOutputBuffer.buffer.size
		);

		encoder.copyTextureToTexture(
			{ texture: this.trailTexture },
			{ texture: this.agentsTexture },
			[this.settings.texWidth, this.settings.texHeight, 1],
		);

		const commandBuffer = encoder.finish();
		this.device.queue.submit([commandBuffer]);

		// console.log debug buffer values
		// if (renderCount % 420 == 2) {
		// 	await this.debugOutputBuffer.buffer.mapAsync(GPUMapMode.READ);
		// 	const res = new Float32Array(uDebugOutputBuffer.getMappedRange());
		// 	console.log(res);

		// 	uDebugOutputBuffer.unmap();
		// }

		return true;
	}

	protected async makePipeline() {
		const computeModule = this.device.createShaderModule({
			label: "slime mold::module::compute",
			code: computeShaderCode,
		});

		const renderModule = this.device.createShaderModule({
			label: "slime mold::module::render",
			code: renderShaderCode,
		});

		this.#createLayouts();

		// * PIPELINES

		this.computeUpdatePipeline = this.device.createComputePipeline({
			label: "slime mold::pipeline::compute::update_agents",
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: [
					this.computeBindGroupLayout0,
					this.computeBindGroupLayout1,
				],
			}),
			compute: {
				module: computeModule,
				entryPoint: "update_agents",
			},
		});

		this.computeProcessPipeline = this.device.createComputePipeline({
			label: "slime mold::pipeline::compute::process_trailmap",
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: [
					this.computeBindGroupLayout0,
					this.computeBindGroupLayout1,
				],
			}),
			compute: {
				module: computeModule,
				entryPoint: "process_trailmap",
			},
		});

		this.renderPipeline = this.device.createRenderPipeline({
			label: "slime mold::pipeline::render",
			layout: "auto",
			vertex: {
				module: renderModule,
				entryPoint: "vs",
			},
			fragment: {
				module: renderModule,
				entryPoint: "fs",
				targets: [{ format: this.format }],
			}
		});

		this.#createBindGroups();
	}

	protected async createAssets() {
		this.#createTextures();
		this.#createBuffers();
	}

	#getAgents() {
		const agentGenerator = new AgentGenerator(
			this.settings.texWidth,
			this.settings.texHeight,
		);

		return agentGenerator.getAgents(
			this.#totalAgentCount,
			agentGenerator.pos.filledCircle,
			agentGenerator.dir.fromCenter,
		);
	}

	#createTextures() {
		const { texWidth, texHeight } = this.settings;

		this.bgTexture = (() => {
			let bgTexData = new Array(texWidth * texHeight * 4).fill(0);

			if (this.settings.includeBg) {
				bgTexData = bgTexData.flatMap((_, i) => ([
					(i % texWidth) / texWidth * 255 / 2,
					Math.floor(i / texWidth) / texHeight * 255 / 2,
					255 / 2,
					0 // padding for alignment
				]));
			}

			const bgTexUint8Array = new Uint8Array(bgTexData);

			const texture = this.device.createTexture({
				label: `${this.label}::tex::bg`,
				size: [texWidth, texHeight],
				format: "rgba8unorm",
				usage: GPUTextureUsage.COPY_DST
					| GPUTextureUsage.TEXTURE_BINDING
					| GPUTextureUsage.STORAGE_BINDING
			});

			this.device.queue.writeTexture(
				{ texture },
				bgTexUint8Array,
				{ bytesPerRow: texWidth * 4 },
				{ width: texWidth, height: texHeight },
			);

			return texture;
		})();

		this.agentsTexture = (() => {
			// initialize with all 0s
			const agentsTexData = new Uint8Array(
				new Array(texWidth * texHeight * 4).fill(0)
			);

			const texture = this.device.createTexture({
				label: `${this.label}::tex::agents`,
				size: [texWidth, texHeight],
				format: "rgba8unorm",
				usage: GPUTextureUsage.COPY_DST
					| GPUTextureUsage.TEXTURE_BINDING
					| GPUTextureUsage.STORAGE_BINDING
			});

			this.device.queue.writeTexture(
				{ texture },
				agentsTexData,
				{ bytesPerRow: texWidth * 4 },
				{ width: texWidth, height: texHeight },
			);

			return texture;
		})();

		this.trailTexture = (() => {
			// initialize with all 0s
			const agentsTexData = new Uint8Array(
				new Array(texWidth * texHeight * 4)
					.fill(0)
			);

			const texture = this.device.createTexture({
				label: `${this.label}::tex::trails`,
				size: [texWidth, texHeight],
				format: "rgba8unorm",
				usage: GPUTextureUsage.COPY_DST
					| GPUTextureUsage.COPY_SRC
					| GPUTextureUsage.TEXTURE_BINDING
					| GPUTextureUsage.STORAGE_BINDING
			});

			this.device.queue.writeTexture(
				{ texture },
				agentsTexData,
				{ bytesPerRow: texWidth * 4 },
				{ width: texWidth, height: texHeight },
			);

			return texture;
		})();
	}

	#createBuffers() {
		// Uniform - SimOptions - BufferAsset can't handle views yet...
		// MUST BE IN ALPHABETICAL ORDER TO MATCH WGSL STRUCT!
		const uSimOptionsValues = new ArrayBuffer(80);
		const uSimOptionsViews = {
			diffuseSpeed: new Float32Array(uSimOptionsValues, 0, 1),
			evaporateSpeed: new Float32Array(uSimOptionsValues, 4, 1),
			evaporateWeight: new Float32Array(uSimOptionsValues, 16, 4),
			moveSpeed: new Float32Array(uSimOptionsValues, 32, 1),
			agentCounts: new Uint32Array(uSimOptionsValues, 48, 3),
			sensorAngle: new Float32Array(uSimOptionsValues, 60, 1),
			sensorDst: new Float32Array(uSimOptionsValues, 64, 1),
			sensorSize: new Uint32Array(uSimOptionsValues, 68, 1),
			turnSpeed: new Float32Array(uSimOptionsValues, 72, 1),
		};

		const uSimOptionsBuffer = this.device.createBuffer({
			size: uSimOptionsValues.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.simOptionsBuffer = {
			values: uSimOptionsValues,
			view: uSimOptionsViews,
			buffer: uSimOptionsBuffer,
		};

		// Simple buffers (single Float32Array)
		this.sceneInfoBuffer = new SimpleBufferAsset(
			this.device,
			new Float32Array(2),
			{ usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST },
		);

		this.debugInputBuffer = new SimpleBufferAsset(
			this.device,
			new Float32Array([0, 0, 0, 0, 0, 0]),
			{
				label: "debug output buffer",
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
			},
		);

		this.debugOutputBuffer = new SimpleBufferAsset(
			this.device,
			new Float32Array([0, 0, 0, 0, 0, 0]),
			{
				label: "debug output buffer",
				usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
			},
		);

		// Storage - Agents
		const sAgentsBufferValues = new Float32Array(this.#getAgents());
		this.agentsBuffer = new SimpleBufferAsset(
			this.device,
			sAgentsBufferValues,
			{ usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST }
		);
	}

	#createLayouts() {
		// These are very tedious and repetitive
		// but I need them to share bind groups between pipelines
		this.computeBindGroupLayout0 = this.device.createBindGroupLayout({
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" },
				},
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" },
				},
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "storage" },
				},
			],
		});

		this.computeBindGroupLayout1 = this.device.createBindGroupLayout({
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "storage" },
				},
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					storageTexture: { format: "rgba8unorm" },
				},
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					texture: {},
				},
			]
		});
	}

	#createBindGroups() {
		const sampler = this.device.createSampler(TEXTURE_OPTIONS);

		this.computeBindGroup0 = this.device.createBindGroup({
			label: "slime mold::bindgroup::compute::0",
			layout: this.computeBindGroupLayout0,
			entries: [
				{ binding: 0, resource: { buffer: this.sceneInfoBuffer.buffer } },
				{ binding: 1, resource: { buffer: this.simOptionsBuffer.buffer } },
				{ binding: 2, resource: { buffer: this.debugInputBuffer.buffer } },
			],
		});

		this.computeBindGroup1 = this.device.createBindGroup({
			label: "slime mold::bindgroup::compute::1",
			layout: this.computeBindGroupLayout1,
			entries: [
				{ binding: 0, resource: { buffer: this.agentsBuffer.buffer } },
				{ binding: 1, resource: this.agentsTexture.createView() },
				{ binding: 2, resource: this.trailTexture.createView() },
			],
		});

		this.computeBindGroup2 = this.device.createBindGroup({
			label: "slime mold::bindgroup::compute::2",
			layout: this.computeBindGroupLayout1,
			entries: [
				{ binding: 0, resource: { buffer: this.agentsBuffer.buffer } },
				{ binding: 1, resource: this.trailTexture.createView() },
				{ binding: 2, resource: this.agentsTexture.createView() },
			],
		});

		this.renderBindGroup = this.device.createBindGroup({
			label: "slime mold::bindgroup::render::0",
			layout: this.renderPipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: sampler },
				{ binding: 1, resource: this.bgTexture.createView() },
				{ binding: 2, resource: this.trailTexture.createView() },
			],
		});
	}
}