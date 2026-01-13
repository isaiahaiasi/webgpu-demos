import { mat4 } from "wgpu-matrix";
import { TriangleMesh } from "./TriangleMesh";

import shader from "./shader.wgsl?raw";
import { BaseRenderer } from "../../../utils/BaseRenderer";

interface RendererConstructor<T> {
	constructor: (canvas: HTMLCanvasElement) => T
}

export class TriangleRenderer
extends BaseRenderer {

	triangleMesh: TriangleMesh;

	protected async createAssets() {
		this.triangleMesh = new TriangleMesh(this.device);
	}

	protected async makePipeline() {
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

	protected render(deltaTime: number): boolean {
		this.timeSinceFirstRender = this.timeSinceFirstRender + deltaTime;

		const loopLength = 4;
		const loopTime = (this.timeSinceFirstRender % loopLength) / loopLength;

		// Set up Model-View-Projection matrices.
		const aspect = this.canvas.width / this.canvas.height;

		const projection = mat4.perspective(Math.PI / 4, aspect, 0.1, 10);
		const view = mat4.lookAt([-2, 0, 1], [0, 0, -0.12], [0, 0, 1]);
		const model = mat4.rotate(mat4.identity(), [0, 0, 1], loopTime * Math.PI * 2);

		this.device.queue.writeBuffer(this.uniformBuffer, 0, model.buffer);
		this.device.queue.writeBuffer(this.uniformBuffer, 64, view.buffer);
		this.device.queue.writeBuffer(this.uniformBuffer, 128, projection.buffer);

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

		return true;
	}
}
