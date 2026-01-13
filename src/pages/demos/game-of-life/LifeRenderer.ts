import Stats from "stats.js";
import shaderCode from "./shader.wgsl?raw";
import { BaseRenderer } from "../../../utils/BaseRenderer";

export class LifeRenderer extends BaseRenderer {
	gui: dat.GUI;
	stats: Stats;

	settings = {
		workGroupSize: 16, // Options: 4, 8, 16
		boardWidth: 256,
		boardHeight: 256,
		minFrameTime: .1, // minimum frame time in seconds
		aliveCol: [255 * .35, 255 * .85, 255], // RGB for alive cells
		deadCol: [255 * 0.15, 0, 255 * 0.25], // RGB for dead cells
	};

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

	render() {
		if (this.paused) {
			return false;
		}

		if (this.stats) {
			this.stats.update();
		}

		// Only render at fixed minimum frame time & not paused.
		if (this.timeSinceLastRender < this.settings.minFrameTime) {
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
		this.#initGui();

		const boardAspect = this.settings.boardWidth / this.settings.boardHeight;
		const canvasAspect = this.canvas.width / this.canvas.height;
		const scaleX = canvasAspect > boardAspect ? (boardAspect / canvasAspect) : 1;
		const scaleY = canvasAspect > boardAspect ? 1 : (canvasAspect / boardAspect);

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
				initState[i] = Math.random() > 0.8 ? 1 : 0;
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
			...this.settings.aliveCol.map(c => c / 255), 0,
			...this.settings.deadCol.map(c => c / 255), 0,
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

	async #initGui() {
		// dat.gui assumes DOM is available, so we import it dynamically to avoid
		// issues with Astro SSG attempting to process at build time.
		const dat = await import('dat.gui');
		const parent = this.canvas.parentElement;

		document.getElementById("life-stats")?.remove();
		this.stats = new Stats();
		this.stats.showPanel(0);
		this.stats.dom.style.position = "absolute";
		this.stats.dom.id = "life-stats";
		parent.appendChild(this.stats.dom);
 
		if (this.gui) {
			parent.removeChild(this.gui.domElement);
			this.gui.destroy();
		}

		this.gui = new dat.GUI({ name: 'life::gui', autoPlace: false });
		parent.appendChild(this.gui.domElement);
		this.gui.domElement.id = "life-this.gui";
		this.gui.domElement.style.position = "absolute";
		this.gui.domElement.style.top = "0";
		this.gui.domElement.style.right = "0";

		// Controls that require a full reset
		this.gui.add(this.settings, "workGroupSize", [4, 8, 16])
			.name("WorkGroupSize")
			.onFinishChange(() => {
				this.#restart();
			});
		this.gui.add(this.settings, "boardWidth", 32, 2048, 1)
			.name("BoardWidth")
			.onFinishChange(() => {
				this.#restart();
			});
		this.gui.add(this.settings, "boardHeight", 32, 2048, 1)
			.name("BoardHeight")
			.onFinishChange(() => {
				this.#restart();
			});

		// Controls that can update live
		this.gui.add(this.settings, "minFrameTime", 0, 1, 0.01)
			.name("MinFrameTime");

		this.gui.addColor(this.settings, "aliveCol")
			.name("Alive Color")
			.onChange(() => this.#updateColorBuffer());
		this.gui.addColor(this.settings, "deadCol")
			.name("Dead Color")
			.onChange(() => this.#updateColorBuffer());
	}

	/** restart function passed to GUI to recreate this whole initRender without page reload */
	async #restart() {
		// create a fresh render setup
		this.createAssets();
		await this.makePipeline();
		this.currentBindGroupIndex = 0;
		this.startRenderLoop();
	}

	/** Update GPU uniform buffer with new colors. */
	#updateColorBuffer() {
		const newColors = new Float32Array([
			...this.settings.aliveCol.map(v => v / 255), 0,
			...this.settings.deadCol.map(v => v / 255), 0,
		]);

		this.device.queue.writeBuffer(this.colorBuffer, 0, newColors);
	}
}
