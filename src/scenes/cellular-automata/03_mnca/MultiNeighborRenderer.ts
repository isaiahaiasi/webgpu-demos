import { BaseRenderer } from "../../../utils/BaseRenderer";
import { StructBufferAsset, type ViewDescriptor } from "../../../utils/BufferAsset";
import { getRenderShader, getComputeShader, MAX_RULE_SIZE, MAX_SHAPES_PER_NEIGHBORHOOD, type Neighborhood, type Rule } from "./shaders";


export type MultiLifeRendererSettings = {
	workGroupSize: number; // Options: 4, 8, 16
	width: number;
	height: number;
	minFrameTime: number; // minimum frame time in seconds
	color: {
		alive: number[]; // RGB for alive cells
		dead: number[]; // RGB for dead cells
	};
	initialDensity: number;
	neighborhoods: Neighborhood[];
	rules: Rule[];
};


/** This is a function to avoid multiple renderers sharing the same reference. */
function getDefaultSettings(): MultiLifeRendererSettings {
	return {
		workGroupSize: 16, // Options: 4, 8, 16
		width: 600,
		height: 600,
		minFrameTime: .0, // minimum frame time in seconds
		color: {
			alive: [0.8, 0.9, 1, 1], // RGB for alive cells
			dead: [0.03, 0.03, 0.1, 0], // RGB for dead cells
		},
		initialDensity: .4,

		neighborhoods: [
			{
				shapes: [
					{
						type: 'CIRCLE',
						minDist: 4,
						maxDist: 7,
					}
				]
			},
			{
				shapes: [
					{
						type: 'CIRCLE',
						minDist: 1,
						maxDist: 4,
					}
				]
			}
		],
		rules: [
			{
				neighborhoodIndex: 0,
				result: 1,
				minDensity: 0.21,
				maxDensity: 0.22,
			},
			{
				neighborhoodIndex: 0,
				result: -1,
				minDensity: 0.35,
				maxDensity: 0.50,
			},
			{
				neighborhoodIndex: 0,
				result: -1,
				minDensity: 0.750,
				maxDensity: 0.950,
			},
			{
				neighborhoodIndex: 1,
				result: -1,
				minDensity: 0.1,
				maxDensity: 0.280,
			},
			{
				neighborhoodIndex: 1,
				result: 1,
				minDensity: 0.430,
				maxDensity: 0.550,
			},
			{
				neighborhoodIndex: 0,
				result: -1,
				minDensity: 0.120,
				maxDensity: 0.150,
			}
		],
	};
}


export class MultiLifeRenderer extends BaseRenderer {
	settings: MultiLifeRendererSettings;

	// Rendering state
	currentBindGroupIndex: 1 | 0 = 0; // Ping Pong Buffer index

	// Buffer/texture assets
	neighborhoodBuffer: StructBufferAsset;
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
		settings: Partial<MultiLifeRendererSettings> = {},
		label = "mnca") {
		super(canvas, label);
		this.settings = { ...getDefaultSettings(), ...settings };
		this.loop.frametime.min = this.settings.minFrameTime;
	}


	async restart() {
		this.currentBindGroupIndex = 0;

		await super.restart();
	}

	render() {
		const encoder = this.device.createCommandEncoder({ label: `${this.label}::encoder` });

		// Compute pass
		const computePass = encoder.beginComputePass();
		computePass.setPipeline(this.computePipeline);
		computePass.setBindGroup(0, this.computeBindGroups[this.currentBindGroupIndex]);
		computePass.dispatchWorkgroups(
			Math.ceil(this.settings.width / this.settings.workGroupSize),
			Math.ceil(this.settings.height / this.settings.workGroupSize)
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
		const boardAspect = this.settings.width / this.settings.height;
		const canvasAspect = this.canvas.width / this.canvas.height;
		const scaleX = canvasAspect > boardAspect ? (boardAspect / canvasAspect) : 1;
		const scaleY = canvasAspect > boardAspect ? 1 : (canvasAspect / boardAspect);

		this.computeShaderModule = this.device.createShaderModule({
			label: `${this.label}::shader::compute`,
			code: getComputeShader({
				width: this.settings.width,
				height: this.settings.height,
				workGroupSize: this.settings.workGroupSize,
				neighborhoods: this.settings.neighborhoods,
				rules: this.settings.rules,
			}),
		});

		this.renderShaderModule = this.device.createShaderModule({
			label: `${this.label}::module::shader`,
			// Changing these constants requires a full reset of the pipeline,
			// so there's no benefit in passing them in as uniforms.
			code: getRenderShader({ scaleX, scaleY, width: this.settings.width, height: this.settings.height }),
		});

		// Create two "ping pong" buffers
		this.cellTextures = ['ping', 'pong'].map(p => this.device.createTexture({
			label: `${this.label}::texture::cells::${p}`,
			size: [this.settings.width, this.settings.height],
			format: 'r32uint',
			usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST,
		}));

		{
			// Create initial random state on the CPU
			const initStateArray = new Uint32Array(
				this.settings.width * this.settings.height
			);

			this.initState(initStateArray);

			// Copy initial state to first ping pong buffer
			this.device.queue.writeTexture(
				{ texture: this.cellTextures[0] },
				initStateArray,
				{ bytesPerRow: this.settings.width * 4 },
				[this.settings.width, this.settings.height],
			);
		}

		{
			// Create color uniform buffer
			const colorBufferValues = new Float32Array([
				...this.settings.color.alive,
				...this.settings.color.dead,
			]);

			this.colorBuffer = this.device.createBuffer({
				label: `${this.label}::uniform::colors`,
				size: colorBufferValues.byteLength,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});

			this.device.queue.writeBuffer(
				this.colorBuffer, 0,
				colorBufferValues
			);
		}

		const neighborhoodViews: Record<string, ViewDescriptor> = Object.fromEntries(
			this.settings.neighborhoods.flatMap((_, i) => {
				const shapeStride = 16; // 4 u32s per shape (minDist, maxDist, type, padding)
				const nhOffset = i * (MAX_SHAPES_PER_NEIGHBORHOOD * shapeStride);
				return [
					...Array.from({ length: MAX_SHAPES_PER_NEIGHBORHOOD }, (_, shapeIdx) => {
						const shapeOffset = nhOffset + shapeIdx * shapeStride;
						return [
							[`shape_distance_${i}_${shapeIdx}`, { type: "i32", offset: shapeOffset, length: 2 }],
							[`shape_type_${i}_${shapeIdx}`, { type: "u32", offset: shapeOffset + 8, length: 1 }],
						];
					}).flat()
				];
			})
		);


		this.neighborhoodBuffer = new StructBufferAsset(
			this.device,
			{
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
				label: `${this.label}::uniform::neighborhoods`,
				size: Math.max(256, this.settings.neighborhoods.length * MAX_SHAPES_PER_NEIGHBORHOOD * 16),
			},
			neighborhoodViews
		);

		// Create rules buffer
		const rulesViews: Record<string, ViewDescriptor> = Object.fromEntries(
			this.settings.rules.flatMap((_, i) => ([
				[`rule_${i}`, { type: "f32", offset: i * 16, length: 4 }],
			])
			)
		);

		this.rulesBuffer = new StructBufferAsset(
			this.device,
			{
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
				label: `${this.label}::uniform::rules`,
				size: MAX_RULE_SIZE * 16,
			},
			rulesViews
		);

		this.updateNeighborhoodBuffer();
		this.updateRulesBuffer();
	}

	protected async makePipeline() {
		this.computePipeline = this.device.createComputePipeline({
			label: `${this.label}::pipeline::compute`,
			layout: 'auto',
			compute: { module: this.computeShaderModule, entryPoint: 'main' },
		});

		this.renderPipeline = this.device.createRenderPipeline({
			label: `${this.label}::pipeline::render`,
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
				label: `${this.label}::bindgroup::compute::ping`,
				layout: this.computePipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.cellTextures[0].createView() },
					{ binding: 1, resource: this.cellTextures[1].createView() },
					{ binding: 2, resource: { buffer: this.neighborhoodBuffer.buffer } },
					{ binding: 3, resource: { buffer: this.rulesBuffer.buffer } },
				]
			}),
			this.device.createBindGroup({
				label: `${this.label}::bindgroup::compute::pong`,
				layout: this.computePipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.cellTextures[1].createView() },
					{ binding: 1, resource: this.cellTextures[0].createView() },
					{ binding: 2, resource: { buffer: this.neighborhoodBuffer.buffer } },
					{ binding: 3, resource: { buffer: this.rulesBuffer.buffer } },
				]
			}),
		];

		this.renderBindGroups = [
			this.device.createBindGroup({
				label: `${this.label}::bindgroup::render::ping`,
				layout: this.renderPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.cellTextures[0].createView() },
					{ binding: 1, resource: { buffer: this.colorBuffer } },
				],
			}),
			this.device.createBindGroup({
				label: `${this.label}::bindgroup::render::pong`,
				layout: this.renderPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.cellTextures[1].createView() },
					{ binding: 1, resource: { buffer: this.colorBuffer } },
				],
			}),
		];

		this.renderPassDesc = {
			label: `${this.label}::renderpass-descriptor`,
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

	/** Update GPU uniform buffer with new neighborhoods. */
	updateNeighborhoodBuffer() {
		for (let nIdx = 0; nIdx < this.settings.neighborhoods.length; nIdx++) {
			const neighborhood = this.settings.neighborhoods[nIdx];

			// Set shape count
			//this.neighborhoodBuffer.setOne(`shape_count_${nIdx}`, [neighborhood.shapes.length]);

			// Set each shape
			for (let shapeIdx = 0; shapeIdx < MAX_SHAPES_PER_NEIGHBORHOOD; shapeIdx++) {
				if (shapeIdx < neighborhood.shapes.length) {
					const shape = neighborhood.shapes[shapeIdx];
					this.neighborhoodBuffer.setOne(`shape_type_${nIdx}_${shapeIdx}`,
						[shape.type === 'CIRCLE' ? 1 : 0]
					);
					this.neighborhoodBuffer.setOne(`shape_distance_${nIdx}_${shapeIdx}`, [
						shape.minDist,
						shape.maxDist,
					]);
				} else {
					// Set unused shapes to invalid values
					this.neighborhoodBuffer.setOne(`shape_type_${nIdx}_${shapeIdx}`, [999]);
					this.neighborhoodBuffer.setOne(`shape_distance_${nIdx}_${shapeIdx}`, [0, 0]);
				}
			}
		}

		this.neighborhoodBuffer.write();
	}

	/** Update GPU uniform buffer with new rules. */
	updateRulesBuffer() {
		for (let rIdx = 0; rIdx < this.settings.rules.length; rIdx++) {
			const rule = this.settings.rules[rIdx];
			this.rulesBuffer.setOne(`rule_${rIdx}`, [
				rule.neighborhoodIndex,
				rule.result,
				rule.minDensity,
				rule.maxDensity,
			]);
		}

		this.rulesBuffer.write();
	}

	updateSettings(settings: Partial<MultiLifeRendererSettings>) {
		const updateRules = settings.rules !== this.settings.rules;
		const updateNeighborhoods = settings.neighborhoods !== this.settings.neighborhoods;
		const updateColors = settings.color !== this.settings.color;

		// Determine if restart is required
		// (neighborhood length is hard-coded currently, so that requires a restart)
		const staticSettings: (keyof MultiLifeRendererSettings)[] = [
			"workGroupSize", "width", "height", "initialDensity",
		];

		let doReset = staticSettings.some(k =>
			settings[k] &&
			settings[k] !== this.settings[k]
		);

		if (
			settings.neighborhoods
			&& settings.neighborhoods.length !== this.settings.neighborhoods.length
		) {
			doReset = true;
		}

		Object.entries(settings).forEach(([k, v]) => {
			this.settings[k] = v;
		});

		if (doReset) {
			this.restart();
		} else {
			if (updateColors) this.updateColorBuffer();
			if (updateNeighborhoods) this.updateNeighborhoodBuffer();
			if (updateRules) this.updateRulesBuffer();
		}
	}

	initState(initArray: Uint32Array) {
		// TODO: Call out to a separate shader to get good initial noise.

		// for (let i = 0; i < initArray.length; i++) {
		// 	initArray[i] = Math.random() > this.settings.initialDensity ? 0 : 1;
		// }

		const [cx, cy] = [this.settings.width, this.settings.height]
			.map(n => Math.floor(n / 2));
		const subfieldSize = Math.min(cx / 1.5, cy / 1.5);

		for (let i = 0; i < initArray.length; i++) {
			const x = i % this.settings.width;
			const y = Math.floor(i / this.settings.width);
			const xDist = Math.abs(x - cx);
			const yDist = Math.abs(y - cy);
			const inRange = xDist < subfieldSize && yDist < subfieldSize;
			// 1 from 50% of edge to 
			const isAlive = inRange && Math.random() > this.settings.initialDensity;
			initArray[i] = isAlive ? 1 : 0;
		}
	}
}