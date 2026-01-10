import { mat4 } from "gl-matrix";
import { getGPUDevice } from "../../../utils/wgpu_utils";
import { TriangleMesh } from "./TriangleMesh";

import shader from "./shader.wgsl?raw";

export class Renderer {
	label: string;
	canvas: HTMLCanvasElement;

	// Device/Context objects
	device: GPUDevice;
	context: GPUCanvasContext;
	format: GPUTextureFormat;

	// Pipeline objects
	uniformBuffer: GPUBuffer;
	bindGroup: GPUBindGroup;
	pipeline: GPURenderPipeline;

	// Assets
	triangleMesh: TriangleMesh;

	// TEMP!
	t: number;


	constructor(canvas: HTMLCanvasElement, baseLabel: string) {
		this.canvas = canvas;
		this.label = baseLabel;

		this.t = 0.3;
	}

	async initialize() {
		this.#setupCanvas();
		await this.#setupDevice();
		this.#createAssets();
		await this.#makePipeline();
		this.#render();
	}

	#render() {
		this.t += 0.01;
		if (this.t > 2.0 * Math.PI) {
			this.t -= 2.0 * Math.PI;
		}

		// Set up Model-View-Projection matrices.
		const aspect = this.canvas.width / this.canvas.height;
		const projection = mat4.create();
		mat4.perspective(projection, Math.PI / 4, aspect, 0.1, 10);

		const view = mat4.create();
		mat4.lookAt(view, [-2, 0, 2], [0, 0, 0], [0, 0, 1]);

		const model = mat4.create();
		mat4.rotate(model, model, this.t, [0, 0, 1]);

		this.device.queue.writeBuffer(
			this.uniformBuffer, 0, model as unknown as ArrayBuffer
		);
		this.device.queue.writeBuffer(
			this.uniformBuffer, 64, view as unknown as ArrayBuffer
		);
		this.device.queue.writeBuffer(
			this.uniformBuffer, 128, projection as unknown as ArrayBuffer
		);


		const commandEncoder = this.device.createCommandEncoder({
			label: `${this.label}::encoder`,
		});

		const textureView = this.context.getCurrentTexture().createView();

		const renderpass = commandEncoder.beginRenderPass({
			label: `${this.label}::renderpass`,
			colorAttachments: [{
				view: textureView,
				clearValue: { r: 0.25, g: 0.0, b: 0.5, a: 1.0 },
				loadOp: "clear",
				storeOp: "store",
			}],
		});

		renderpass.setPipeline(this.pipeline);
		renderpass.setVertexBuffer(0, this.triangleMesh.buffer);
		renderpass.setBindGroup(0, this.bindGroup);
		renderpass.draw(3, 1, 0, 0);
		renderpass.end();

		const commandBuffer = commandEncoder.finish();
		this.device.queue.submit([commandBuffer]);

		requestAnimationFrame(() => this.#render());
	}


	#setupCanvas() {
		const width = this.canvas.clientWidth;
		const height = this.canvas.clientHeight;
		const devicePixelRatio = window.devicePixelRatio || 1;
		this.canvas.width = width * devicePixelRatio;
		this.canvas.height = height * devicePixelRatio;
	}

	async #setupDevice() {
		this.device = await getGPUDevice();
		this.context = this.canvas.getContext("webgpu");
		this.format = navigator.gpu.getPreferredCanvasFormat();
		this.context.configure({
			device: this.device,
			format: this.format,
			alphaMode: "opaque",
		});
	}

	async #makePipeline() {
		this.uniformBuffer = this.device.createBuffer({
			label: `${this.label}::uniformbuffer`,
			size: 64 * 3, // 3 * mat4x4
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		const bindGroupLayout = this.device.createBindGroupLayout({
			label: `${this.label}::bindgrouplayout`,
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {},
				},
			],
		});

		this.bindGroup = this.device.createBindGroup({
			label: `${this.label}::bindgroup`,
			layout: bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniformBuffer },
				}
			],
		});

		const pipelineLayout = this.device.createPipelineLayout({
			label: `${this.label}::pipelinelayout`,
			bindGroupLayouts: [bindGroupLayout],
		});

		this.pipeline = this.device.createRenderPipeline({
			label: `${this.label}::renderpipeline`,
			vertex: {
				module: this.device.createShaderModule({
					label: `${this.label}::vertex::shadermodule`,
					code: shader,
				}),
				entryPoint: "vs_main",
				buffers: [this.triangleMesh.bufferLayout],
			},

			fragment: {
				module: this.device.createShaderModule({
					label: `${this.label}::fragment::shadermodule`,
					code: shader,
				}),
				entryPoint: "fs_main",
				targets: [{
					format: this.format,
				}]
			},

			layout: pipelineLayout,
		});
	}

	async #createAssets() {
		this.triangleMesh = new TriangleMesh(this.device);
	}
}