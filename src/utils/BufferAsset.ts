type BufferView = Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer> | Int32Array<ArrayBuffer>;

type ViewDescriptor = {
	offset: number;
	type: "f32" | "u32" | "i32";
	length: number;
};

type ViewType = Float32ArrayConstructor | Uint32ArrayConstructor | Int32ArrayConstructor;


export class StructBufferAsset {
	buffer: GPUBuffer;
	values: ArrayBuffer;
	views: Record<string, BufferView>;

	#device: GPUDevice;

	constructor(
		device: GPUDevice,
		descriptor: GPUBufferDescriptor,
		viewDescriptors: Record<string, ViewDescriptor>,
	) {
		this.#device = device;
		this.values = new ArrayBuffer(descriptor.size);
		this.views = {};

		Object.entries(viewDescriptors).forEach(([key, view_desc]) => {
			let viewType: ViewType;

			if (view_desc.type === "f32")
				viewType = Float32Array;
			else if (view_desc.type === "u32")
				viewType = Uint32Array;
			else if (view_desc.type === "i32")
				viewType = Int32Array;
			else throw new Error("Invalid StructBufferAsset array type: " + view_desc.type);

			this.views[key] = new viewType(this.values, view_desc.offset, view_desc.length);
		});

		this.buffer = device.createBuffer(descriptor);
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