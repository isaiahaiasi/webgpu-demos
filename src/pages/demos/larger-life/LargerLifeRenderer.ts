import computeShaderCode from "./shaders/compute.wgsl?raw";
import renderShaderCode from "./shaders/render.wgsl?raw";

import { BaseRenderer } from "../../../utils/BaseRenderer";
import { StructBufferAsset } from "../../../utils/BufferAsset";

/** 
 * TODO: implement other neighborhood types.
 * NM: Moore (square)
 * NN: Von Neumann (diamond)
 * NC: Circular
 */
type Neighborhood = 'NM';


export type LargerLifeRendererSettings = {
	workGroupSize: number; // Options: 4, 8, 16
	boardWidth: number;
	boardHeight: number;
	minFrameTime: number; // minimum frame time in seconds
	color: {
		alive: number[]; // RGB for alive cells
		dead: number[]; // RGB for dead cells
	};
	rules: {
		initialDensity: number;
		neighborDistance: number;
		// whether current cell should be counted in neighborhood
		includeSelf: boolean;
		birthMin: number;
		birthMax: number;
		survivalMin: number;
		survivalMax: number;

		nieghborhoodType: Neighborhood;
	};
};


/** This is a function to avoid multiple renderers sharing the same reference. */
function getDefaultSettings(): LargerLifeRendererSettings {
	return {
		workGroupSize: 16, // Options: 4, 8, 16
		boardWidth: 512,
		boardHeight: 512,
		minFrameTime: .1, // minimum frame time in seconds
		color: {
			alive: [1, 1, 1, 1], // RGB for alive cells
			dead: [0, 0, 0, 0], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.5,
			neighborDistance: 5, // Area = (2 * dist + 1)^2
			includeSelf: true,
			survivalMin: 0.2809917355,
			survivalMax: 0.479338843,
			birthMin: 0.2809917355,
			birthMax: 0.3719008264,
			nieghborhoodType: 'NM',
		},
	};
}


export class LargerLifeRenderer extends BaseRenderer {
	settings: LargerLifeRendererSettings;

	// Rendering state
	currentBindGroupIndex: 1 | 0 = 0; // Ping Pong Buffer index

	// Buffer/texture assets
	rulesBuffer: StructBufferAsset;
	colorBuffer: GPUBuffer;
	cellTextures: GPUTexture[];

	// Pipeline assets
	computeShaderModule: GPUShaderModule;
	renderShaderModule: GPUShaderModule;

	computePipeline: GPUComputePipeline;
	computeBindGroups: GPUBindGroup[];

	renderPipeline: GPURenderPipeline;
	renderBindGroups: GPUBindGroup[];
	renderPassDesc: GPURenderPassDescriptor;


	constructor(
		canvas: HTMLCanvasElement,
		settings?: Partial<LargerLifeRendererSettings>,
		label = "life") {
		super(canvas, label);
		this.settings = { ...getDefaultSettings(), ...settings };
	}


	async restart() {
		this.currentBindGroupIndex = 0;
		await super.restart();
	}

	render() {
		if (this.loop.paused) {
			return false;
		}

		// Only render at fixed minimum frame time & not paused.
		if (this.loop.timeSinceLastRender < this.settings.minFrameTime) {
			return false;
		}

		const encoder = this.device.createCommandEncoder({ label: 'largerlife::encoder' });

		// Compute pass
		const computePass = encoder.beginComputePass();
		computePass.setPipeline(this.computePipeline);
		computePass.setBindGroup(0, this.computeBindGroups[this.currentBindGroupIndex]);
		computePass.dispatchWorkgroups(
			Math.ceil(this.settings.boardWidth / this.settings.workGroupSize),
			Math.ceil(this.settings.boardHeight / this.settings.workGroupSize)
		);
		computePass.end();

		// Render pass
		this.renderPassDesc.colorAttachments[0].view =
			this.context.getCurrentTexture().createView();

		const renderPass = encoder.beginRenderPass(this.renderPassDesc);
		renderPass.setPipeline(this.renderPipeline);
		renderPass.setBindGroup(0, this.renderBindGroups[this.currentBindGroupIndex])
		renderPass.draw(6);
		renderPass.end();

		this.device.queue.submit([encoder.finish()]);

		// Swap ping pong index for next frame
		this.currentBindGroupIndex = this.currentBindGroupIndex ? 0 : 1;

		return true;
	}

	protected async createAssets() {
		const boardAspect = this.settings.boardWidth / this.settings.boardHeight;
		const canvasAspect = this.canvas.width / this.canvas.height;
		const scaleX = canvasAspect > boardAspect ? (boardAspect / canvasAspect) : 1;
		const scaleY = canvasAspect > boardAspect ? 1 : (canvasAspect / boardAspect);

		this.computeShaderModule = this.device.createShaderModule({
			label: 'largerlife::shader::compute',
			code: `
const BOARD = vec2i(${this.settings.boardWidth}, ${this.settings.boardHeight});
const WORKGROUP_SIZE: u32 = ${this.settings.workGroupSize}u;
` + computeShaderCode,
		});

		this.renderShaderModule = this.device.createShaderModule({
			label: 'largerlife::module::shader',
			// Changing these constants requires a full reset of the pipeline,
			// so there's no benefit in passing them in as uniforms.
			code: `
const BOARD = vec2u(${this.settings.boardWidth}u, ${this.settings.boardHeight}u);
const SCALE = vec2f(${scaleX}f, ${scaleY}f);
` + renderShaderCode,
		});

		// Create two "ping pong" buffers
		this.cellTextures = ['ping', 'pong'].map(p => this.device.createTexture({
			label: `largerlife::texture::cells::${p}`,
			size: [this.settings.boardWidth, this.settings.boardHeight],
			format: 'r32uint',
			usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST,
		}));

		{
			// Create initial random state on the CPU
			const initState = new Uint32Array(
				this.settings.boardWidth * this.settings.boardHeight
			);

			for (let i = 0; i < initState.length; i++) {
				initState[i] = Math.random() > this.settings.rules.initialDensity ? 0 : 1;
			}

			// Copy initial state to first ping pong buffer
			this.device.queue.writeTexture(
				{ texture: this.cellTextures[0] },
				initState,
				{ bytesPerRow: this.settings.boardWidth * 4 },
				[this.settings.boardWidth, this.settings.boardHeight],
			);
		}

		{
			// Create color uniform buffer
			const colorBufferValues = new Float32Array([
				...this.settings.color.alive,
				...this.settings.color.dead,
			]);

			this.colorBuffer = this.device.createBuffer({
				label: 'largerlife::uniform::colors',
				size: colorBufferValues.byteLength,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});

			this.device.queue.writeBuffer(
				this.colorBuffer, 0,
				colorBufferValues
			);
		}

		this.rulesBuffer = new StructBufferAsset(
			this.device,
			{
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
				size: 80,
			},
			{
				includeSelf: { offset: 0, length: 1, type: 'i32' },
				neighborDistance: { offset: 4, length: 1, type: 'i32' },
				birthRange: { offset: 8, length: 2, type: 'f32' },
				survivalRange: { offset: 16, length: 2, type: 'f32' },
			},
		);

		this.updateRuleBuffer();
	}

	protected async makePipeline() {
		this.computePipeline = this.device.createComputePipeline({
			label: "largerlife::pipeline::compute",
			layout: 'auto',
			compute: { module: this.computeShaderModule, entryPoint: 'main' },
		});

		this.renderPipeline = this.device.createRenderPipeline({
			label: 'largerlife::pipeline::render',
			layout: 'auto',
			vertex: { module: this.renderShaderModule, entryPoint: 'vs' },
			fragment: {
				module: this.renderShaderModule,
				entryPoint: 'fs',
				targets: [{ format: this.format }],
			},
			primitive: { topology: 'triangle-list' },
		});

		this.computeBindGroups = [
			this.device.createBindGroup({
				label: 'largerlife::bindgroup::compute::ping',
				layout: this.computePipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.cellTextures[0].createView() },
					{ binding: 1, resource: this.cellTextures[1].createView() },
					{ binding: 2, resource: this.rulesBuffer.buffer },
				]
			}),
			this.device.createBindGroup({
				label: 'largerlife::bindgroup::compute::pong',
				layout: this.computePipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.cellTextures[1].createView() },
					{ binding: 1, resource: this.cellTextures[0].createView() },
					{ binding: 2, resource: this.rulesBuffer.buffer },
				]
			}),
		];

		this.renderBindGroups = [
			this.device.createBindGroup({
				label: 'largerlife::bindgroup::render::ping',
				layout: this.renderPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.cellTextures[0].createView() },
					{ binding: 1, resource: { buffer: this.colorBuffer } },
				],
			}),
			this.device.createBindGroup({
				label: 'largerlife::bindgroup::render::pong',
				layout: this.renderPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.cellTextures[1].createView() },
					{ binding: 1, resource: { buffer: this.colorBuffer } },
				],
			}),
		];

		this.renderPassDesc = {
			label: 'largerlife::renderpass',
			colorAttachments: [{
				view: undefined, // Assigned at render time
				loadOp: 'clear',
				storeOp: 'store',
				clearValue: [0, 0, 0, 1], // black
			}],
		};
	}

	/** Update GPU uniform buffer with new colors. */
	updateColorBuffer() {
		const newColors = new Float32Array([
			...this.settings.color.alive,
			...this.settings.color.dead,
		]);

		this.device.queue.writeBuffer(this.colorBuffer, 0, newColors);
	}

	/** Update GPU uniform buffer with new rules. */
	updateRuleBuffer() {
		this.rulesBuffer.set({
			includeSelf: [this.settings.rules.includeSelf ? 1 : 0],
			neighborDistance: [this.settings.rules.neighborDistance],
			birthRange: [this.settings.rules.birthMin, this.settings.rules.birthMax],
			survivalRange: [this.settings.rules.survivalMin, this.settings.rules.survivalMax],
		});
	}
}
