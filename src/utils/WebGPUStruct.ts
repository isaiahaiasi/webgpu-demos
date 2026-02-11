/**
 * WebGPU Struct - manages struct data with proper alignment and padding
 * 
 * @example
 * ```ts
 * const myStruct = new WebGPUStruct({
 *   color: 'vec4f',
 *   intensity: 'f32',
 *   count: 'i32',
 *   position: 'vec3f',
 *   enabled: 'u32'
 * });
 * 
 * myStruct.set('color', [1, 0, 0, 1]);
 * myStruct.set('intensity', 0.5);
 * const buffer = myStruct.getArrayBuffer();
 * ```
 */

export type WGSLType =
  | 'f32' | 'i32' | 'u32'
  | 'vec2f' | 'vec2i' | 'vec2u'
  | 'vec3f' | 'vec3i' | 'vec3u'
  | 'vec4f' | 'vec4i' | 'vec4u'
  | 'mat2x2f' | 'mat3x3f' | 'mat4x4f';

export type StructLayout = Record<string, WGSLType>;

export type ScalarValue = number;
export type VectorValue = number[] | Float32Array | Int32Array | Uint32Array;
export type StructValue = ScalarValue | VectorValue;

interface WebGPUStructOptions {
  uniformBuffer?: boolean;
}

interface TypeInfo {
  byteSize: number;
  alignment: number;
  componentCount: number;
}

interface FieldInfo {
  name: string;
  type: WGSLType;
  offset: number;
  size: number;
  alignment: number;
  componentCount: number;
}

export interface LayoutInfo {
  name: string;
  type: WGSLType;
  offset: number;
  size: number;
  alignment: number;
}

export class WebGPUStruct<T extends StructLayout = StructLayout> {
  // Type information: [byteSize, alignment, componentCount]
  private static readonly TYPE_INFO: Record<WGSLType, TypeInfo> = {
    'f32': { byteSize: 4, alignment: 4, componentCount: 1 },
    'i32': { byteSize: 4, alignment: 4, componentCount: 1 },
    'u32': { byteSize: 4, alignment: 4, componentCount: 1 },
    'vec2f': { byteSize: 8, alignment: 8, componentCount: 2 },
    'vec2i': { byteSize: 8, alignment: 8, componentCount: 2 },
    'vec2u': { byteSize: 8, alignment: 8, componentCount: 2 },
    'vec3f': { byteSize: 12, alignment: 16, componentCount: 3 },  // 12 bytes, but 16-byte aligned
    'vec3i': { byteSize: 12, alignment: 16, componentCount: 3 },
    'vec3u': { byteSize: 12, alignment: 16, componentCount: 3 },
    'vec4f': { byteSize: 16, alignment: 16, componentCount: 4 },
    'vec4i': { byteSize: 16, alignment: 16, componentCount: 4 },
    'vec4u': { byteSize: 16, alignment: 16, componentCount: 4 },
    'mat2x2f': { byteSize: 16, alignment: 8, componentCount: 4 },
    'mat3x3f': { byteSize: 48, alignment: 16, componentCount: 9 },
    'mat4x4f': { byteSize: 64, alignment: 16, componentCount: 16 },
  };

  private readonly layout: T;
  private readonly fields: FieldInfo[] = [];
  private readonly fieldMap = new Map<string, FieldInfo>();
  private readonly uniformBuffer: boolean;
  public readonly totalSize: number;

  // Single ArrayBuffer and DataView for the entire struct
  private readonly buffer: ArrayBuffer;
  private readonly view: DataView;

  // Typed array views for efficient bulk updates
  private readonly float32View: Float32Array;
  private readonly int32View: Int32Array;
  private readonly uint32View: Uint32Array;

  constructor(layout: T, options: WebGPUStructOptions = {}) {
    this.layout = layout;
    this.uniformBuffer = options.uniformBuffer ?? false;
    this.totalSize = this._computeLayout();

    // Single ArrayBuffer and DataView for the entire struct
    this.buffer = new ArrayBuffer(this.totalSize);
    this.view = new DataView(this.buffer);

    // Typed array views for efficient bulk updates
    this.float32View = new Float32Array(this.buffer);
    this.int32View = new Int32Array(this.buffer);
    this.uint32View = new Uint32Array(this.buffer);
  }

  /**
   * Compute the memory layout with proper alignment and padding
   */
_computeLayout() {
  if (Object.keys(this.layout).length === 0) {
    throw new Error('Struct layout cannot be empty');
  }

  let offset = 0;
  let maxAlignment = 0;

  for (const [name, type] of Object.entries(this.layout)) {
    const typeInfo = WebGPUStruct.TYPE_INFO[type];
    if (!typeInfo) {
      throw new Error(`Unknown type: ${type}`);
    }

    const {byteSize, alignment, componentCount} = typeInfo;

    // Track the maximum alignment requirement
    maxAlignment = Math.max(maxAlignment, alignment);

    // Apply alignment padding
    const alignmentPadding = (alignment - (offset % alignment)) % alignment;
    offset += alignmentPadding;

    const field = {
      name,
      type,
      offset,
      size: byteSize,
      alignment,
      componentCount
    };

    this.fields.push(field);
    this.fieldMap.set(name, field);

    offset += byteSize;
  }

  // Align total size to the largest alignment requirement
  // For uniform buffers, minimum alignment is 16 bytes
  const structAlignment = this.uniformBuffer ? Math.max(maxAlignment, 16) : maxAlignment;
  const finalPadding = (structAlignment - (offset % structAlignment)) % structAlignment;
  return offset + finalPadding;
}

  /**
   * Set a field value
   */
  set<K extends keyof T & string>(name: K, value: StructValue): this {
    const field = this.fieldMap.get(name);
    if (!field) {
      throw new Error(`Unknown field: ${name}`);
    }

    const isFloat = field.type.includes('f');
    const isInt = field.type.includes('i') && !field.type.includes('u');
    const isUint = field.type.includes('u');

    if (field.componentCount === 1) {
      // Scalar value
      const scalar = value as number;
      if (isFloat) {
        this.view.setFloat32(field.offset, scalar, true);
      } else if (isInt) {
        this.view.setInt32(field.offset, scalar, true);
      } else if (isUint) {
        this.view.setUint32(field.offset, scalar, true);
      }
    } else {
      // Vector or matrix
      const values = Array.isArray(value) ? value : Array.from(value as ArrayLike<number>);

      if (values.length !== field.componentCount) {
        throw new Error(
          `Expected ${field.componentCount} components for ${field.type}, got ${values.length}`
        );
      }

      const byteOffset = field.offset / 4; // Convert to element offset

      if (isFloat) {
        this.float32View.set(values, byteOffset);
      } else if (isInt) {
        this.int32View.set(values, byteOffset);
      } else if (isUint) {
        this.uint32View.set(values, byteOffset);
      }
    }

    return this;
  }

  /**
   * Get a field value
   */
  get<K extends keyof T & string>(name: K): number | Float32Array | Int32Array | Uint32Array {
    const field = this.fieldMap.get(name);
    if (!field) {
      throw new Error(`Unknown field: ${name}`);
    }

    const isFloat = field.type.includes('f');
    const isInt = field.type.includes('i') && !field.type.includes('u');
    const isUint = field.type.includes('u');

    if (field.componentCount === 1) {
      // Scalar value
      if (isFloat) {
        return this.view.getFloat32(field.offset, true);
      } else if (isInt) {
        return this.view.getInt32(field.offset, true);
      } else if (isUint) {
        return this.view.getUint32(field.offset, true);
      }
    } else {
      // Vector or matrix - return a copy
      if (isFloat) {
        return new Float32Array(
          this.buffer,
          field.offset,
          field.componentCount
        ).slice();
      } else if (isInt) {
        return new Int32Array(
          this.buffer,
          field.offset,
          field.componentCount
        ).slice();
      } else if (isUint) {
        return new Uint32Array(
          this.buffer,
          field.offset,
          field.componentCount
        ).slice();
      }
    }

    throw new Error(`Unable to get value for field: ${name}`);
  }

  /**
   * Set multiple fields at once
   */
  setAll(values: Partial<Record<keyof T, StructValue>>): this {
    for (const [name, value] of Object.entries(values)) {
      if (value !== undefined) {
        this.set(name as keyof T & string, value);
      }
    }
    return this;
  }

  /**
   * Get the underlying ArrayBuffer
   */
  getArrayBuffer(): ArrayBuffer {
    return this.buffer;
  }

  /**
   * Get a Uint8Array view of the buffer
   */
  getUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * Copy data to a target buffer (e.g., GPUBuffer via writeBuffer)
   */
  copyTo(target: Uint8Array | ArrayBuffer, targetOffset = 0): void {
    const source = new Uint8Array(this.buffer);
    if (target instanceof ArrayBuffer) {
      new Uint8Array(target).set(source, targetOffset);
    } else {
      target.set(source, targetOffset);
    }
  }

  /**
   * Get layout information for debugging
   */
  getLayoutInfo(): LayoutInfo[] {
    return this.fields.map(f => ({
      name: f.name,
      type: f.type,
      offset: f.offset,
      size: f.size,
      alignment: f.alignment
    }));
  }

  /**
   * Print layout for debugging
   */
  printLayout(): void {
    console.log(`Struct Layout (total size: ${this.totalSize} bytes):`);
    console.log('─'.repeat(60));

    for (let i = 0; i < this.fields.length; i++) {
      const field = this.fields[i];
      const prevField = this.fields[i - 1];

      if (i > 0 && prevField) {
        const padding = field.offset - (prevField.offset + prevField.size);
        if (padding > 0) {
          console.log(`  [padding: ${padding} bytes]`);
        }
      }

      console.log(
        `  ${field.name.padEnd(15)} ${field.type.padEnd(10)} ` +
        `offset: ${field.offset.toString().padStart(3)}, ` +
        `size: ${field.size.toString().padStart(2)}, ` +
        `align: ${field.alignment}`
      );
    }

    const lastField = this.fields[this.fields.length - 1];
    if (lastField) {
      const finalPadding = this.totalSize - (lastField.offset + lastField.size);
      if (finalPadding > 0) {
        console.log(`  [final padding: ${finalPadding} bytes]`);
      }
    }

    console.log('─'.repeat(60));
  }

  /**
   * Reset all fields to zero
   */
  reset(): this {
    this.float32View.fill(0);
    return this;
  }

  /**
   * Clone the struct with the same layout
   */
  clone(): WebGPUStruct<T> {
    const cloned = new WebGPUStruct(this.layout);
    cloned.float32View.set(this.float32View);
    return cloned;
  }
}
