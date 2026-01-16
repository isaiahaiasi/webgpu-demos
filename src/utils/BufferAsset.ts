type BufferView = Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;

type ViewDescriptor = {
	offset: number;
	type: "f32" | "u32";
	length: number;
};


export class StructBufferAsset {
	buffer: GPUBuffer;
	values: ArrayBuffer;
	views: Record<string, BufferView>;

	#device: GPUDevice;

	constructor(
		device: GPUDevice,
		size: number,
		descriptor: Omit<GPUBufferDescriptor, "size">,
		viewDescriptors: Record<string, ViewDescriptor>,
	) {
		this.#device = device;
		this.values = new ArrayBuffer(size);
		this.views = {};

		Object.entries(viewDescriptors).forEach(([key, desc]) => {
			const ViewType = desc.type === "f32" ? Float32Array : Uint32Array;
			this.views[key] = new ViewType(this.values, desc.offset, desc.length);
		});

		this.buffer = device.createBuffer({
			...descriptor,
			size,
		});
	}

	setOne(key: string, value: ArrayLike<number>) {
		if (!this.views[key]) {
			console.error(`View "${key}" not found in buffer`);
			return;
		}

		this.views[key].set(typeof value === 'number' ? [value] : value);
		this.#device.queue.writeBuffer(this.buffer, 0, this.values);
	}

	set(values: Record<string, ArrayLike<number>>) {
		Object.entries(values).forEach(([key, value]) => {
			if (this.views[key]) {
				this.views[key].set(value);
			}
		});
		this.#device.queue.writeBuffer(this.buffer, 0, this.values);
	}
}


/** Does not support multiple "views" */
export class SimpleBufferAsset {
	buffer: GPUBuffer;
	values: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
	#device: GPUDevice;

	constructor(
		device: GPUDevice,
		initialArray: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>,
		descriptor: Omit<GPUBufferDescriptor, "size">,
	) {
		this.#device = device;
		this.values = initialArray;

		this.buffer = device.createBuffer({
			...descriptor,
			size: initialArray.byteLength,
		});

		this.set(initialArray);
	}

	set(value: ArrayLike<number>) {
		this.values.set(value);
		this.#device.queue.writeBuffer(this.buffer, 0, this.values);
	}
}