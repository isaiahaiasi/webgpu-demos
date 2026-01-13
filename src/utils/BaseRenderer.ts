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

	// Rendering state
	timeSinceFirstRender = 0;
	timeSinceLastRender: number;
	paused = true;
	#animFrameId: number;

	/**
	 * @returns If frame was fully rendered.
	 */
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
		this.createAssets();
		await this.makePipeline();
		this.startRenderLoop();
	}

	get hasErrors() {
		return this.errors.length > 0;
	}

	#fail(message: string) {
		console.error(message);
		this.errors.push(message);
	}

	startRenderLoop() {
		let prevTime = 0;

		if (this.#animFrameId) {
			cancelAnimationFrame(this.#animFrameId);
		}

		this.paused = false;

		const render = (currentTime: number) => {
			this.#animFrameId = null;

			const deltaTime = (currentTime - prevTime) * 0.001 // ms -> s
			prevTime = currentTime;

			const resetTimeSinceLastRender = this.render(deltaTime);

			if (resetTimeSinceLastRender) {
				this.timeSinceLastRender = 0;
			} else {
				this.timeSinceLastRender += deltaTime;
			}

			if (!this.paused) {
				this.#animFrameId = requestAnimationFrame(render);
			}
		}

		this.#animFrameId = requestAnimationFrame((t) => render(t));
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