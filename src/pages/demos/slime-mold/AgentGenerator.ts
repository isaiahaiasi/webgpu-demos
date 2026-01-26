export type PosMode = 'center' | 'field' | 'subField' | 'filledCircle';
export type DirMode = 'random' | 'toCenter' | 'fromCenter';

export default class AgentGenerator {
	cx: number;
	cy: number;
	w: number;
	h: number;

	constructor(texWidth: number, texHeight: number) {
		this.w = texWidth;
		this.h = texHeight;
		this.cx = texWidth / 2;
		this.cy = texHeight / 2;
	}

	get posFunctionNames() {
		return Object.keys(this.#posFunctions);
	}

	get dirFunctionNames() {
		return Object.keys(this.#dirFunctions);
	}

	#posFunctions: Record<PosMode, () => string> = {
		center: () => `
fn getPosition(idx: u32) -> vec2f {
	return vec2f(CX, CY);
}`,

		field: () => `
fn getPosition(idx: u32) -> vec2f {
	let r = random2(idx);
	return vec2f(r.x * W, r.y * H);
}`,

		subField: () => {
			const pct = 3;
			const offsetX = this.w / pct;
			const offsetY = this.h / pct;
			const scaleX = this.w * (pct - 2) / pct;
			const scaleY = this.h * (pct - 2) / pct;
			return `
fn getPosition(idx: u32) -> vec2f {
	let r = random2(idx);
	return vec2f(
		${offsetX}f + r.x * ${scaleX}f,
		${offsetY}f + r.y * ${scaleY}f
	);
}`;
		},

		filledCircle: () => {
			const radiusScale = 0.5;
			const maxRadius = this.cy * radiusScale;
			return `
fn getPosition(idx: u32) -> vec2f {
	let r = random2(idx);
	let radius = ${maxRadius}f * r.x;
	let theta = r.y * PI * 2.0;
	return vec2f(
		CX + radius * cos(theta),
		CY + radius * sin(theta)
	);
}`;
		},
	};

	#dirFunctions: Record<DirMode, () => string> = {
		random: () => `
fn getDirection(idx: u32, pos: vec2f) -> f32 {
	return random(idx * 3u) * PI * 2.0;
}`,

		toCenter: () => `
fn getDirection(idx: u32, pos: vec2f) -> f32 {
	return atan2(pos.y - CY, pos.x - CX) + PI;
}`,

		fromCenter: () => `
fn getDirection(idx: u32, pos: vec2f) -> f32 {
	return atan2(pos.y - CY, pos.x - CX);
}`,
	};

	/**
	 * Creates a compute shader that initializes agents on the GPU
	 */
	createInitShader(posMode: PosMode, dirMode: DirMode): string {
		return `
struct Agent {
	pos: vec2f,
	dir: f32,
	padding: f32,
}

@group(0) @binding(0) var<storage, read_write> agents: array<Agent>;

const PI = 3.14159265359;
const CX = ${this.cx}f;
const CY = ${this.cy}f;
const W = ${this.w}f;
const H = ${this.h}f;

// Simple hash function for deterministic random numbers
fn hash(v: u32) -> u32 {
	var state = v;
	state = state ^ 2747636419u;
	state = state * 2654435769u;
	state = state ^ (state >> 16u);
	state = state * 2654435769u;
	state = state ^ (state >> 16u);
	state = state * 2654435769u;
	return state;
}

fn random(seed: u32) -> f32 {
	return f32(hash(seed)) / 4294967295.0;
}

fn random2(seed: u32) -> vec2f {
	return vec2f(random(seed), random(seed * 2u + 1u));
}

${this.#posFunctions[posMode]()}

${this.#dirFunctions[dirMode]()}

@compute @workgroup_size(64)
fn init_agents(@builtin(global_invocation_id) id: vec3u) {
	let idx = id.x;
	if (idx >= arrayLength(&agents)) {
		return;
	}

	let pos = getPosition(idx);
	let dir = getDirection(idx, pos);

	agents[idx].pos = pos;
	agents[idx].dir = dir;
	agents[idx].padding = 0.0;
}
`;
	}

	/**
	 * GPU-based initialization
	 */
	async init(
		device: GPUDevice,
		agentsBuffer: GPUBuffer,
		numAgents: number,
		posMode: PosMode,
		dirMode: DirMode,
	): Promise<void> {
		const shaderCode = this.createInitShader(posMode, dirMode);
		const shaderModule = device.createShaderModule({
			label: 'agent-init-shader',
			code: shaderCode,
		});

		const pipeline = device.createComputePipeline({
			label: 'agent-init-pipeline',
			layout: 'auto',
			compute: {
				module: shaderModule,
				entryPoint: 'init_agents',
			},
		});

		const bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: agentsBuffer } },
			],
		});

		const encoder = device.createCommandEncoder({ label: 'agent-init-encoder' });
		const pass = encoder.beginComputePass();
		pass.setPipeline(pipeline);
		pass.setBindGroup(0, bindGroup);
		
		const workgroupSize = 64;
		const numWorkgroups = Math.ceil(numAgents / workgroupSize);
		pass.dispatchWorkgroups(numWorkgroups);
		pass.end();

		device.queue.submit([encoder.finish()]);
		await device.queue.onSubmittedWorkDone();
	}
}
