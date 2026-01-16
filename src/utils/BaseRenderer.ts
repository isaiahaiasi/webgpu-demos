import { RenderLoop } from "./RenderLoop";

export abstract class BaseRenderer {

	label: string;
	errors: string[] = [];

	canvas: HTMLCanvasElement;

	// Device/Context objects
	device: GPUDevice;
	context: GPUCanvasContext;
	format: GPUTextureFormat;

	// Pipeline objects
	uniformBuffer: GPUBuffer;
	bindGroup: GPUBindGroup;
	pipeline: GPURenderPipeline;

	loop = new RenderLoop((dt) => this.render(dt));

	/** @returns If frame was fully rendered. */
	protected abstract render(deltaTime: number): boolean;

	protected abstract makePipeline(): Promise<void>;

	protected abstract createAssets(): Promise<void>;


	constructor(canvas: HTMLCanvasElement, baseLabel: string) {
		this.canvas = canvas;
		this.label = baseLabel;
	}

	async initialize() {
		this.#setupCanvas();
		await this.#setupDevice();

		this.restart();
	}

	async restart() {
		this.createAssets();
		await this.makePipeline();
		this.loop.start();
	}

	get hasErrors() {
		return this.errors.length > 0;
	}

	onRender(listener: () => void) {
		this.loop.pubsub.add('render', listener);
	}

	onStep(listener: () => void) {
		this.loop.pubsub.add('step', listener);
	}

	onStart(listener: () => void) {
		this.loop.pubsub.add('start', listener);
	}

	onStop(listener: () => void) {
		this.loop.pubsub.add('stop', listener);
	}

	#fail(message: string) {
		console.error(message);
		this.errors.push(message);
	}

	#setupCanvas() {
		const width = this.canvas.clientWidth;
		const height = this.canvas.clientHeight;
		const devicePixelRatio = window.devicePixelRatio || 1;
		this.canvas.width = width * devicePixelRatio;
		this.canvas.height = height * devicePixelRatio;
	}

	async #setupDevice() {
		if (!navigator.gpu) {
			this.#fail("This browser does not support WebGPU");
			return;
		}

		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			this.#fail("This browser supports WebGPU, but it appears disabled");
			return;
		}

		this.device = await adapter.requestDevice();
		this.device.lost.then((info) => {
			this.#fail(`WebGPU device was lost: ${info.message}`);

			// "reason" will be "destroyed" if we *intentionally* destroy the device
			if (info.reason !== "destroyed") {
				// try again?
			}
		});

		this.context = this.canvas.getContext("webgpu");
		this.format = navigator.gpu.getPreferredCanvasFormat();
		this.context.configure({
			device: this.device,
			format: this.format,
			alphaMode: "opaque",
		});
	}
}