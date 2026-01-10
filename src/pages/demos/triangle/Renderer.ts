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
	bindGroup: GPUBindGroup;
	pipeline: GPURenderPipeline;

	// Assets
	triangleMesh: TriangleMesh;


	constructor(canvas: HTMLCanvasElement, baseLabel: string) {
		this.canvas = canvas;
		this.label = baseLabel;
	}

	async initialize() {
		await this.#setupDevice();
		this.#createAssets();
		await this.#makePipeline();
		this.#render();
	}

	#render() {
		const commandEncoder = this.device.createCommandEncoder({
			label: `${this.label}::encoder`,
		});
		const textureView = this.context.getCurrentTexture().createView();
		const renderpass = commandEncoder.beginRenderPass({
			label: `${this.label}::renderpass`,
			colorAttachments: [{
				view: textureView,
				clearValue: { r: 0.25, g: 0.0, b: 0.5, a: 1.0},
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
		const bindGroupLayout = this.device.createBindGroupLayout({
			label: `${this.label}::bindgrouplayout`,
			entries: [],
		});

		this.bindGroup = this.device.createBindGroup({
			label: `${this.label}::bindgroup`,
			layout: bindGroupLayout,
			entries: [],
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