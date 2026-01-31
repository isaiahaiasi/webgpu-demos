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

	// GPU Performance timestamps
	// TODO: move to separate module
	queryTimestamps: boolean;
	querySet: GPUQuerySet;
	resolveBuffer: GPUBuffer;
	resultBuffer: GPUBuffer;
	perfTimes = new Map<string, number>();


	/** @returns If frame was fully rendered. */
	protected abstract render(deltaTime: number): boolean;

	protected abstract makePipeline(): Promise<void>;

	protected abstract createAssets(): Promise<void>;


	constructor(canvas: HTMLCanvasElement, baseLabel: string, queryTimestamps = false) {
		this.canvas = canvas;
		this.label = baseLabel;
		this.queryTimestamps = queryTimestamps;

		// Back pressure to prevent several commandBuffers being queued up at once,
		// which would create a negative feedback loop and can rapidly degrade
		// performance once frames start dropping.
		this.onRender(() => {
			this.loop.framesPending++;

			this.device.queue.onSubmittedWorkDone().then(() => {
				this.loop.framesPending--;
			});
		});
	}

	async initialize() {
		this.#setupCanvas();
		await this.#setupDevice();
		this.restart();
	}

	async restart() {
		this.createAssets();
		await this.makePipeline();
		this.loop.restart();
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

		this.queryTimestamps = this.queryTimestamps && adapter.features.has('timestamp-query');

		this.device = await adapter.requestDevice({
			requiredFeatures: this.queryTimestamps ? ['timestamp-query'] : [],
		});

		this.device.lost.then((info) => {
			this.#fail(`WebGPU device was lost: ${info.message}`);

			// "reason" will be "destroyed" if we *intentionally* destroy the device
			if (info.reason === "destroyed") {
				this.loop.pubsub.call("stop");
			} else {
				// TODO: try again?
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

	setupTimestamps(times: string[]) {
		if (!this.queryTimestamps) {
			return;
		}

		times.forEach(t => {
			this.perfTimes.set(t, 0);
		});

		this.querySet = this.device.createQuerySet({
			type: 'timestamp',
			count: times.length * 2,
		});
		this.resolveBuffer = this.device.createBuffer({
			size: this.querySet.count * 8,
			usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
		});
		this.resultBuffer = this.device.createBuffer({
			size: this.resolveBuffer.size,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});
	}

	updateTimestamp(timeName: string, value: Number | BigInt) {
		this.perfTimes.set(timeName, Number(value));
	}
}
