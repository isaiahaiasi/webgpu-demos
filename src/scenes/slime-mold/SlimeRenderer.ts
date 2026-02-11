import { BaseRenderer } from "../../utils/BaseRenderer";
import { SimpleBufferAsset, StructBufferAsset } from "../../utils/BufferAsset";

import renderShaderCode from "./shaders/render.wgsl?raw";
import computeShaderCode from "./shaders/compute.wgsl?raw";
import AgentGenerator, { type DirMode, type PosMode } from "./AgentGenerator";
import { WebGPUStruct } from "../../utils/WebGPUStruct";


const TEXTURE_OPTIONS: GPUSamplerDescriptor = {
	addressModeU: "clamp-to-edge",
	addressModeV: "clamp-to-edge",
	magFilter: "linear",
	minFilter: "linear",
} as const;


export class SlimeRenderer extends BaseRenderer {
	settings = {
		// reload required
		texWidth: 1600,
		texHeight: 800,
		agentCountTrunc: 1_000, // x1000 (truncated for UI purposes...)
		get agentCount() {
			return this.agentCountTrunc * 1_000;
		},
		startModePos: 'filledCircle' as PosMode,
		startModeDir: 'fromCenter' as DirMode,

		// currently requires reload but easily refactorable
		includeBg: false,

		// no reload
		evaporateSpeed: 3,
		evaporateColor: [0.39, 0.90, 0.94, 1],
		backgroundColor: [0.12, 0, 0.27, 1],
		diffuseSpeed: 50,
		moveSpeed: 80,
		sensorAngle: 25 * (Math.PI / 180), // radian angle of left/right sensors
		sensorDst: 10,
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
	bgColorBuffer: SimpleBufferAsset;

	simOptionsStruct: WebGPUStruct;
	simOptionsBuffer: GPUBuffer;

	// BindGroup Layouts
	computeBindGroupLayout0: GPUBindGroupLayout;
	computeBindGroupLayout1: GPUBindGroupLayout;

	//BindGroups
	computeBindGroup0: GPUBindGroup;
	computeBindGroup1: GPUBindGroup;
	computeBindGroup2: GPUBindGroup;
	renderBindGroup1: GPUBindGroup;
	renderBindGroup2: GPUBindGroup;

	//Pipelines
	computeUpdatePipeline: GPUComputePipeline;
	computeProcessPipeline: GPUComputePipeline;
	renderPipeline: GPURenderPipeline;

	renderPassDescriptor: GPURenderPassDescriptor;
	computePassAgentsDescriptor: GPUComputePassDescriptor;
	computePassTrailsDescriptor: GPUComputePassDescriptor;

	pingPong: boolean = false;

	constructor(canvas: HTMLCanvasElement, baseLabel: string) {
		super(canvas, baseLabel, true);
	}


	protected render(deltaTime: number): boolean {
		this.pingPong = !this.pingPong;

		// TODO: improve calculations 
		// Sim gets wonky outside 30-60fps, clamp logic to that range.
		// I care more about the step-to-step behavior than execution timing.
		deltaTime = Math.min(Math.max(deltaTime, 0.016), 0.067);

		this.sceneInfoBuffer.set([performance.now(), deltaTime]);

		const agentEncoder = this.device.createCommandEncoder({ label: `${this.label}::encoder::compute-agents` });

		let computePass = agentEncoder.beginComputePass(this.computePassAgentsDescriptor);
		computePass.setPipeline(this.computeUpdatePipeline);
		computePass.setBindGroup(0, this.computeBindGroup0);
		computePass.setBindGroup(1, this.pingPong ? this.computeBindGroup1 : this.computeBindGroup2);
		const workgroupSize = 64;
		const numWorkgroups = Math.ceil(this.settings.agentCount / workgroupSize);
		computePass.dispatchWorkgroups(numWorkgroups, 1, 1);
		computePass.end();

		this.device.queue.submit([agentEncoder.finish()]);

		const encoder2 = this.device.createCommandEncoder({ label: `${this.label}::encoder::compute-trails` });

		computePass = encoder2.beginComputePass(this.computePassTrailsDescriptor);
		computePass.setPipeline(this.computeProcessPipeline);
		computePass.setBindGroup(0, this.computeBindGroup0);
		computePass.setBindGroup(1, this.pingPong ? this.computeBindGroup2 : this.computeBindGroup1);
		computePass.dispatchWorkgroups(
			Math.ceil(this.settings.texWidth / 16),
			Math.ceil(this.settings.texHeight / 16)
		);
		computePass.end();

		this.device.queue.submit([encoder2.finish()]);

		const encoder = this.device.createCommandEncoder({ label: `${this.label}::encoder::render` })

		this.renderPassDescriptor.colorAttachments[0].view =
			this.context.getCurrentTexture().createView();

		const renderPass = encoder.beginRenderPass(this.renderPassDescriptor);
		renderPass.setPipeline(this.renderPipeline);

		const renderBindGroup = this.pingPong ? this.renderBindGroup2 : this.renderBindGroup1;

		renderPass.setBindGroup(0, renderBindGroup);
		renderPass.draw(6);
		renderPass.end();

		if (this.queryTimestamps) {
			encoder.resolveQuerySet(
				this.querySet, 0,
				this.querySet.count,
				this.resolveBuffer, 0
			);
			if (this.resultBuffer.mapState === 'unmapped') {
				encoder.copyBufferToBuffer(
					this.resolveBuffer, 0,
					this.resultBuffer, 0,
					this.resultBuffer.size
				);
			}
		}

		const commandBuffer = encoder.finish();
		this.device.queue.submit([commandBuffer]);

		if (this.queryTimestamps && this.resultBuffer.mapState === 'unmapped') {
			this.resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
				const times = new BigUint64Array(this.resultBuffer.getMappedRange());
				this.updateTimestamp("agents", times[1] - times[0]);
				this.updateTimestamp("trails", times[3] - times[2]);
				this.updateTimestamp("render", times[5] - times[4]);
				this.resultBuffer.unmap();
			});
		}

		return true;
	}

	public updateUniforms() {
		this.bgColorBuffer.set(this.settings.backgroundColor);

		this.simOptionsStruct.setAll({
				diffuseSpeed: this.settings.diffuseSpeed,
				evaporateSpeed: this.settings.evaporateSpeed,
				evaporateWeight: [...this.settings.evaporateColor.map(c => 1 - c)], // invert color
				moveSpeed: this.settings.moveSpeed,
				agentCount: this.settings.agentCount,
				sensorAngle: this.settings.sensorAngle,
				sensorDst: this.settings.sensorDst,
				turnSpeed: this.settings.turnSpeed,
		});

		this.device.queue.writeBuffer(this.simOptionsBuffer, 0, this.simOptionsStruct.getArrayBuffer());
	}

	protected async makePipeline() {
		const boardAspect = this.settings.texWidth / this.settings.texHeight;
		const canvasAspect = this.canvas.width / this.canvas.height;
		const scaleX = canvasAspect > boardAspect ? (boardAspect / canvasAspect) : 1;
		const scaleY = canvasAspect > boardAspect ? 1 : (canvasAspect / boardAspect);

		const computeModule = this.device.createShaderModule({
			label: `${this.label}::shader::compute`,
			code: `\
				const i_TEX_DIMENSIONS = vec2i(${this.settings.texWidth}, ${this.settings.texHeight});
				const f_TEX_DIMENSIONS = vec2f(${this.settings.texWidth}, ${this.settings.texHeight});
				const TEX_WORKGROUP_SIZE = 16u;
				${computeShaderCode}
			`,
		});

		const renderModule = this.device.createShaderModule({
			label: `${this.label}::shader::render`,
			code: `\
				const SCALE_X = ${scaleX}f;
				const SCALE_Y = ${scaleY}f;
				${renderShaderCode}
			`,
		});

		this.#createLayouts();

		// * PIPELINES

		this.computeUpdatePipeline = this.device.createComputePipeline({
			label: `${this.label}::pipeline::compute::update_agents`,
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
			label: `${this.label}::pipeline::compute::process_trailmap`,
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
			label: `${this.label}::pipeline::render`,
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

		this.computePassAgentsDescriptor = {
			...(this.queryTimestamps && {
				timestampWrites: {
					querySet: this.querySet,
					beginningOfPassWriteIndex: 0,
					endOfPassWriteIndex: 1,
				}
			})
		}
		this.computePassTrailsDescriptor = {
			...(this.queryTimestamps && {
				timestampWrites: {
					querySet: this.querySet,
					beginningOfPassWriteIndex: 2,
					endOfPassWriteIndex: 3,
				}
			})
		}

		this.renderPassDescriptor = {
			label: `${this.label}::descriptor::render-pass`,
			colorAttachments: [{
				view: undefined as any, // We'll set this each frame
				clearValue: [0, 0, 0, 1], // black
				loadOp: "clear",
				storeOp: "store",
			}],
			...(this.queryTimestamps && {
				timestampWrites: {
					querySet: this.querySet,
					beginningOfPassWriteIndex: 4,
					endOfPassWriteIndex: 5,
				},
			})
		};
	}

	protected async createAssets() {
		this.#createTextures();
		this.#createBuffers();
		this.setupTimestamps(["agents", "trails", "render"]);
		this.updateUniforms();
		await this.#initAgents();
	}

	async #initAgents() {
		const agentGenerator = new AgentGenerator(
			this.settings.texWidth,
			this.settings.texHeight,
		);

		if (!agentGenerator.dirFunctionNames.includes(this.settings.startModeDir)) {
			this.settings.startModeDir = 'fromCenter';
		}

		if (!agentGenerator.posFunctionNames.includes(this.settings.startModePos)) {
			this.settings.startModePos = 'filledCircle';
		}

		await agentGenerator.init(
			this.device,
			this.agentsBuffer.buffer,
			this.settings.agentCount,
			this.settings.startModePos,
			this.settings.startModeDir,
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

		[this.agentsTexture, this.trailTexture] = ["ping-(agents)", "pong-(trail)"].map(
			(label) => {
				// initialize with all 0s
				const agentsTexData = new Uint8Array(
					new Array(texWidth * texHeight * 4).fill(0)
				);

				const texture = this.device.createTexture({
					label: `${this.label}::tex::${label}`,
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
			});
	}

	#createBuffers() {
		this.simOptionsStruct = new WebGPUStruct({
			diffuseSpeed: 'f32',
			evaporateSpeed: 'f32',
			evaporateWeight: 'vec4f',
			moveSpeed: 'f32',
			agentCount: 'u32',
			sensorAngle: 'f32',
			sensorDst: 'f32',
			turnSpeed: 'f32',
		}, { uniformBuffer: true });

		this.simOptionsBuffer = this.device.createBuffer({
			label: `${this.label}::uniform::sim-options`,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			size: this.simOptionsStruct.totalSize,
		});

		// Simple buffers (single Float32Array)
		this.sceneInfoBuffer = new SimpleBufferAsset(
			this.device,
			new Float32Array(2),
			{ usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST },
		);

		this.bgColorBuffer = new SimpleBufferAsset(
			this.device,
			new Float32Array(4),
			{ usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST },
		);

		// Storage - Agents
		this.agentsBuffer = new SimpleBufferAsset(
			this.device,
			new Float32Array(this.settings.agentCount * 4),
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
					storageTexture: { format: "rgba8unorm" },
				},
				{
					binding: 1,
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
				{ binding: 1, resource: { buffer: this.simOptionsBuffer } },
				{ binding: 2, resource: { buffer: this.agentsBuffer.buffer } },
			],
		});

		this.computeBindGroup1 = this.device.createBindGroup({
			label: "slime mold::bindgroup::compute::ping",
			layout: this.computeBindGroupLayout1,
			entries: [
				{ binding: 0, resource: this.agentsTexture.createView() },
				{ binding: 1, resource: this.trailTexture.createView() },
			],
		});

		this.computeBindGroup2 = this.device.createBindGroup({
			label: "slime mold::bindgroup::compute::pong",
			layout: this.computeBindGroupLayout1,
			entries: [
				{ binding: 0, resource: this.trailTexture.createView() },
				{ binding: 1, resource: this.agentsTexture.createView() },
			],
		});

		this.renderBindGroup1 = this.device.createBindGroup({
			label: "slime mold::bindgroup::render::ping",
			layout: this.renderPipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: sampler },
				{ binding: 1, resource: this.bgTexture.createView() },
				{ binding: 2, resource: this.trailTexture.createView() },
				{ binding: 3, resource: { buffer: this.bgColorBuffer.buffer } },
			],
		});

		this.renderBindGroup2 = this.device.createBindGroup({
			label: "slime mold::bindgroup::render::pong",
			layout: this.renderPipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: sampler },
				{ binding: 1, resource: this.bgTexture.createView() },
				{ binding: 2, resource: this.agentsTexture.createView() },
				{ binding: 3, resource: { buffer: this.bgColorBuffer.buffer } },
			],
		});
	}
}