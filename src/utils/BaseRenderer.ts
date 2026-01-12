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

	/** Time elapsed since rendering began. */
	t: number;

	/**
	 * @returns Request next frame.
	 */
	protected abstract render(deltaTime: number): boolean;

	protected abstract makePipeline(): Promise<void>;

	protected abstract createAssets(): Promise<void>;


	constructor(canvas: HTMLCanvasElement, baseLabel: string) {
		this.canvas = canvas;
		this.label = baseLabel;
		this.t = 0;
	}

	async initialize() {
		this.#setupCanvas();
		await this.#setupDevice();
		this.createAssets();
		await this.makePipeline();
		this.#handleRenderLoop();
	}

	get hasErrors() {
		return this.errors.length > 0;
	}

	#fail(message: string) {
		console.error(message);
		this.errors.push(message);
	}

	#handleRenderLoop() {
		let prevTime = 0;

		const render = (currentTime: number) => {
			const deltaTime = (currentTime - prevTime) * 0.001 // ms -> s
			prevTime = currentTime;

			const continue_loop = this.render(deltaTime);

			if (continue_loop) {
				requestAnimationFrame(render);
			}
		}

		requestAnimationFrame((t) => render(t));
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