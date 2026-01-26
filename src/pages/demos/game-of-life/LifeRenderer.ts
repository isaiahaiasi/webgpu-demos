import shaderCode from "./shader.wgsl?raw";
import { BaseRenderer } from "../../../utils/BaseRenderer";


export type LifeRendererSettings = {
		workGroupSize: number; // Options: 4, 8, 16
		boardWidth: number;
		boardHeight: number;
		minFrameTime: number; // minimum frame time in seconds
		color: {
			alive: number[], // RGB for alive cells
			dead: number[], // RGB for dead cells
		};
		rules: {
			initialDensity: number,
			birth: number[],
			survival: number[],
		};
	};


/** This is a function to avoid multiple renderers sharing the same reference. */
function getDefaultSettings(): LifeRendererSettings {
	return {
		workGroupSize: 16, // Options: 4, 8, 16
		boardWidth: 256,
		boardHeight: 256,
		minFrameTime: .1, // minimum frame time in seconds
		color: {
			alive: [.35, .85, 1], // RGB for alive cells
			dead: [0.15, 0, 0.25], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.2,
			birth: [3],
			survival: [2,3],
		}
	};
}


export class LifeRenderer extends BaseRenderer {
	settings: LifeRendererSettings;

	// Rendering state
	currentBindGroupIndex: 1 | 0 = 0; // Ping Pong Buffer index

	// Buffer/texture assets
	cellTextures: GPUTexture[];
	colorBuffer: GPUBuffer;

	// Pipeline assets
	sharedShaderModule: GPUShaderModule;

	computePipeline: GPUComputePipeline;
	computeBindGroups: GPUBindGroup[];

	renderPipeline: GPURenderPipeline;
	renderBindGroups: GPUBindGroup[];
	renderPassDesc: GPURenderPassDescriptor;


	constructor(
		canvas: HTMLCanvasElement,
		settings?: Partial<LifeRendererSettings>,
		label = "life") {
			super(canvas, label);
			this.settings = {...getDefaultSettings(), ...settings};
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

		const encoder = this.device.createCommandEncoder({ label: 'life::encoder' });

		// Compute pass
		const computePass = encoder.beginComputePass();
		computePass.setPipeline(this.computePipeline);
		computePass.setBindGroup(1, this.computeBindGroups[this.currentBindGroupIndex]);
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
		renderPass.draw(6); // (calls vertex shader 4 times)
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

		/** Returns array{9}, with indices given by m set to 1, otherwise 0 */
		const getStateMap = (m: number[]) => {
			const state = new Array(9).fill(0);
			m.forEach(m => { state[m] = 1; });
			return state;
		}

		this.sharedShaderModule = this.device.createShaderModule({
			label: 'life::module::shader',
			// Changing these constants requires a full reset of the pipeline,
			// so there's no benefit in passing them in as uniforms.
			code: `
const BoardWidth : u32 = ${this.settings.boardWidth}u;
const BoardHeight : u32 = ${this.settings.boardHeight}u;
const ScaleX : f32 = ${scaleX};
const ScaleY : f32 = ${scaleY};
const WorkGroupSize : u32 = ${this.settings.workGroupSize}u;
const BIRTH_MAP: array<u32, 9> =    array(${getStateMap(this.settings.rules.birth)});
const SURVIVAL_MAP: array<u32, 9> = array(${getStateMap(this.settings.rules.survival)});
` + shaderCode,
		});

		// Create two "ping pong" buffers
		this.cellTextures = ['ping', 'pong'].map(p => this.device.createTexture({
			label: `life::texture::cells::${p}`,
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

		const colorBufferValues = new Float32Array([
			...this.settings.color.alive, 0,
			...this.settings.color.dead, 0,
		]);

		this.colorBuffer = this.device.createBuffer({
			label: 'life::uniform::colors',
			size: colorBufferValues.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.device.queue.writeBuffer(this.colorBuffer, 0, colorBufferValues);
	}

	protected async makePipeline() {
		this.computePipeline = this.device.createComputePipeline({
			label: "life::pipeline::compute",
			layout: 'auto',
			compute: { module: this.sharedShaderModule, entryPoint: 'main' },
		});

		this.renderPipeline = this.device.createRenderPipeline({
			label: 'life::pipeline::render',
			layout: 'auto',
			vertex: { module: this.sharedShaderModule, entryPoint: 'vs' },
			fragment: {
				module: this.sharedShaderModule,
				entryPoint: 'fs',
				targets: [{ format: this.format }],
			},
			primitive: { topology: 'triangle-list' },
		});

		this.computeBindGroups = [
			this.device.createBindGroup({
				label: 'life::bindgroup::compute::ping',
				layout: this.computePipeline.getBindGroupLayout(1),
				entries: [
					{ binding: 0, resource: this.cellTextures[0].createView() },
					{ binding: 1, resource: this.cellTextures[1].createView() },
				]
			}),
			this.device.createBindGroup({
				label: 'life::bindgroup::compute::pong',
				layout: this.computePipeline.getBindGroupLayout(1),
				entries: [
					{ binding: 0, resource: this.cellTextures[1].createView() },
					{ binding: 1, resource: this.cellTextures[0].createView() },
				]
			}),
			// TODO: empty bindgroup so firefox doesn't get mad at skipping idx 0?
			// this.device.createBindGroup({
			// })
		];

		this.renderBindGroups = [
			this.device.createBindGroup({
				label: 'life::bindgroup::render::ping',
				layout: this.renderPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.cellTextures[0].createView() },
					{ binding: 1, resource: { buffer: this.colorBuffer } },
				],
			}),
			this.device.createBindGroup({
				label: 'life::bindgroup::render::pong',
				layout: this.renderPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.cellTextures[1].createView() },
					{ binding: 1, resource: { buffer: this.colorBuffer } },
				],
			}),
		];

		this.renderPassDesc = {
			label: 'life::renderpass',
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
			...this.settings.color.alive, 1,
			...this.settings.color.dead, 1,
		]);

		this.device.queue.writeBuffer(this.colorBuffer, 0, newColors);
	}
}
