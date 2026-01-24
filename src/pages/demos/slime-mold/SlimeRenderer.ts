import { BaseRenderer } from "../../../utils/BaseRenderer";
import { BaseGui } from "../../../utils/BaseGui";
import { SimpleBufferAsset, StructBufferAsset } from "../../../utils/BufferAsset";

import renderShaderCode from "./shaders/render.wgsl?raw";
import computeShaderCode from "./shaders/compute.wgsl?raw";

/*
CURRENT ISSUES:
- Buffer handling is crazy
*/

type DirMethod = (pos?: [number, number]) => number;
type PosMethod = () => [number, number];


const TEXTURE_OPTIONS: GPUSamplerDescriptor = {
	addressModeU: "clamp-to-edge",
	addressModeV: "clamp-to-edge",
	magFilter: "linear",
	minFilter: "linear",
} as const;


export class SlimeGui extends BaseGui {
	declare renderer: SlimeRenderer;

	protected async initGui() {
		await super.initGui();

		this.gui.add(this.renderer.settings, "evaporateSpeed", 0, 15, .1);
		this.gui.add(this.renderer.settings, "diffuseSpeed", 0, 60);
		this.gui.add(this.renderer.settings, "moveSpeed", 0, 150, 1);
		this.gui.add(this.renderer.settings, "sensorAngle", (Math.PI / 180), 90 * (Math.PI / 180));
		this.gui.add(this.renderer.settings, "sensorDst", 1, 100);
		this.gui.add(this.renderer.settings, "sensorSize", 1, 3, 1);
		this.gui.add(this.renderer.settings, "turnSpeed", 1, 50);
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
		agentCounts: [2000, 2000, 1] as [number, number, number], // vec3

		// currently requires reload but easily refactorable
		includeBg: false,

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

	// Avoid allocating new arrays every frame.
	private sceneInfoArray = new Float32Array(2);
	private simOptionsData = {
		diffuseSpeed: new Float32Array(1),
		evaporateSpeed: new Float32Array(1),
		evaporateWeight: new Float32Array(4),
		moveSpeed: new Float32Array(1),
		agentCounts: new Uint32Array(3),
		sensorAngle: new Float32Array(1),
		sensorDst: new Float32Array(1),
		sensorSize: new Uint32Array(1),
		turnSpeed: new Float32Array(1),
	}

	// ASSETS

	// Textures
	agentsTexture: GPUTexture;
	trailTexture: GPUTexture;
	bgTexture: GPUTexture;

	// Buffers (Storage & Uniform)
	agentsBuffer: SimpleBufferAsset;
	sceneInfoBuffer: SimpleBufferAsset;
	simOptionsBuffer: StructBufferAsset;

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

	renderPassDescriptor: GPURenderPassDescriptor;

	// Performance handling
	private framesPending = 0;
	private maxPendingFrames = 2;


	get #totalAgentCount() {
		return this.settings.agentCounts.reduce((a, b) => a * b);
	}

	constructor(canvas: HTMLCanvasElement, label: string) {
		super(canvas, label);
		this.onStart(() => { console.log("Start!") });
		this.onStop(() => { console.log("Stop!") });
	}

	protected render(deltaTime: number): boolean {
		if (this.framesPending >= this.maxPendingFrames) {
        return false;  // Skip this frame
    }
    
    this.framesPending++;
	
		this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();

		this.sceneInfoArray[0] = deltaTime;
    this.sceneInfoArray[1] = deltaTime;
    this.sceneInfoBuffer.set(this.sceneInfoArray);

    this.simOptionsData.diffuseSpeed[0] = this.settings.diffuseSpeed;
    this.simOptionsData.evaporateSpeed[0] = this.settings.evaporateSpeed;
    this.simOptionsData.evaporateWeight.set(this.settings.evaporateWeight);
    this.simOptionsData.moveSpeed[0] = this.settings.moveSpeed;
    this.simOptionsData.agentCounts.set(this.settings.agentCounts);
    this.simOptionsData.sensorAngle[0] = this.settings.sensorAngle;
    this.simOptionsData.sensorDst[0] = this.settings.sensorDst;
    this.simOptionsData.sensorSize[0] = this.settings.sensorSize;
    this.simOptionsData.turnSpeed[0] = this.settings.turnSpeed;
    
    this.simOptionsBuffer.set(this.simOptionsData);

		this.device.queue.writeBuffer(
			this.simOptionsBuffer.buffer,
			0,
			this.simOptionsBuffer.values,
		);


		const encoder = this.device.createCommandEncoder({ label: "slime mold::encoder" });

		let computePass = encoder.beginComputePass();
		computePass.setPipeline(this.computeUpdatePipeline);
		computePass.setBindGroup(0, this.computeBindGroup0);
		computePass.setBindGroup(1, this.computeBindGroup1);
		const workgroupSize = 64;
		const numWorkgroups = Math.ceil(this.#totalAgentCount / workgroupSize);
		computePass.dispatchWorkgroups(numWorkgroups, 1, 1);
		computePass.end();

		computePass = encoder.beginComputePass();
		computePass.setPipeline(this.computeProcessPipeline);
		computePass.setBindGroup(0, this.computeBindGroup0);
		computePass.setBindGroup(1, this.computeBindGroup2);
		computePass.dispatchWorkgroups(
			Math.ceil(this.settings.texWidth / 16),
			Math.ceil(this.settings.texHeight / 16)
		);
		computePass.end();


		this.renderPassDescriptor.colorAttachments[0].view =
			this.context.getCurrentTexture().createView();

		const renderPass = encoder.beginRenderPass(this.renderPassDescriptor);
		renderPass.setPipeline(this.renderPipeline);

		renderPass.setBindGroup(0, this.renderBindGroup);
		renderPass.draw(6);
		renderPass.end();

		encoder.copyTextureToTexture(
			{ texture: this.trailTexture },
			{ texture: this.agentsTexture },
			[this.settings.texWidth, this.settings.texHeight, 1],
		);

		const commandBuffer = encoder.finish();
		this.device.queue.submit([commandBuffer]);

		this.device.queue.onSubmittedWorkDone().then(() => {
        this.framesPending--;
    });

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

		this.renderPassDescriptor = {
			label: "slime mold::renderpassdescriptor",
			colorAttachments: [{
				view: undefined as any, // We'll set this each frame
				clearValue: [0.3, 0.3, 0.3, 1],
				loadOp: "clear",
				storeOp: "store",
			}],
		};
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

		this.simOptionsBuffer = new StructBufferAsset(
			this.device,
			80,
			{ usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST },
			{
				// MUST BE IN ALPHABETICAL ORDER TO MATCH WGSL STRUCT!
				diffuseSpeed: { type: 'f32', offset: 0, length: 1 },
				evaporateSpeed: { offset: 4, length: 1, type: 'f32' },
				evaporateWeight: { offset: 16, length: 4, type: 'f32' },
				moveSpeed: { offset: 32, length: 1, type: 'f32' },
				agentCounts: { offset: 48, length: 3, type: 'u32' },
				sensorAngle: { offset: 60, length: 1, type: 'f32' },
				sensorDst: { offset: 64, length: 1, type: 'f32' },
				sensorSize: { offset: 68, length: 1, type: 'u32' },
				turnSpeed: { offset: 72, length: 1, type: 'f32' },
			}
		);

		// Simple buffers (single Float32Array)
		this.sceneInfoBuffer = new SimpleBufferAsset(
			this.device,
			new Float32Array(2),
			{ usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST },
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