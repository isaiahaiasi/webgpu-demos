type StructLayout = {
  [key: string]:
  | string  // Primitive type like 'vec3f'
  | StructLayout  // Nested struct
  | [WebGPUStruct | StructLayout, number];  // Array
};

interface WebGPUStructOptions {
  uniformBuffer?: boolean;
}

interface FieldInfo {
  name: string;
  type: string;
  offset: number;
  size: number;
  alignment: number;
  componentCount: number;
  path: string[];  // For nested access like ['camera', 'position']
  isArray?: boolean;
  arrayLength?: number;
  arrayStride?: number;
  isStruct?: boolean;
  structDef?: WebGPUStruct;
}


/**
 * Enhanced WebGPU Struct with nested structs and arrays
 * 
 * Usage:
 * ```
 * const lightStruct = new WebGPUStruct({
 *   position: 'vec3f',
 *   color: 'vec3f',
 *   intensity: 'f32',
 * });
 * 
 * const sceneStruct = new WebGPUStruct({
 *   camera: {
 *     position: 'vec3f',
 *     direction: 'vec3f',
 *   },
 *   lights: ['array', lightStruct, 4], // array of 4 lights
 *   ambientColor: 'vec3f',
 * });
 * ```
 */
export class WebGPUStruct {
  // Type information: [byteSize, alignment, componentCount]
  static TYPES = {
    'f32': [4, 4, 1],
    'i32': [4, 4, 1],
    'u32': [4, 4, 1],
    'vec2f': [8, 8, 2],
    'vec2i': [8, 8, 2],
    'vec2u': [8, 8, 2],
    'vec3f': [12, 16, 3],
    'vec3i': [12, 16, 3],
    'vec3u': [12, 16, 3],
    'vec4f': [16, 16, 4],
    'vec4i': [16, 16, 4],
    'vec4u': [16, 16, 4],
    'mat2x2f': [16, 8, 4],
    'mat3x3f': [48, 16, 9],
    'mat4x4f': [64, 16, 16],
  };

  layout: StructLayout;
  fields: FieldInfo[];
  fieldMap: Map<string, FieldInfo>;
  totalSize: number;
  uniformBuffer: boolean;
  buffer: ArrayBuffer;
  view: DataView;
  float32View: Float32Array;
  int32View: Int32Array;
  uint32View: Uint32Array;

  constructor(layout: StructLayout, options: WebGPUStructOptions = {}) {
    if (Object.keys(layout).length === 0) {
      throw new Error('Struct layout cannot be empty');
    }

    this.layout = layout;
    this.fields = [];
    this.fieldMap = new Map();
    this.totalSize = 0;
    this.uniformBuffer = options.uniformBuffer ?? false;

    this._computeLayout();

    // Single ArrayBuffer and DataView for the entire struct
    this.buffer = new ArrayBuffer(this.totalSize);
    this.view = new DataView(this.buffer);

    // Typed array views for efficient bulk updates
    this.float32View = new Float32Array(this.buffer);
    this.int32View = new Int32Array(this.buffer);
    this.uint32View = new Uint32Array(this.buffer);
  }

  /**
   * Compute the memory layout with proper alignment, padding, arrays, and nested structs
   */
  private _computeLayout() {
    let offset = 0;
    let maxAlignment = 0;

    for (const [name, typeSpec] of Object.entries(this.layout)) {
      const result = this._processField(name, typeSpec, offset, [name]);

      maxAlignment = Math.max(maxAlignment, result.alignment);
      offset = result.nextOffset;

      // Store all fields (including nested ones)
      this.fields.push(...result.fields);
      result.fields.forEach(field => {
        const key = field.path.join('.');
        this.fieldMap.set(key, field);
      });
    }

    // Align total size to the largest alignment requirement
    // For uniform buffers, minimum alignment is 16 bytes
    const structAlignment = this.uniformBuffer
      ? Math.max(maxAlignment, 16)
      : maxAlignment;
    const finalPadding = (structAlignment - (offset % structAlignment)) % structAlignment;
    this.totalSize = offset + finalPadding;
  }

  /**
   * Process a single field (primitive, array, or nested struct)
   */
  private _processField(
    name: string,
    typeSpec: string | StructLayout | [WebGPUStruct | StructLayout, number],
    offset: number,
    path: string[]
  ): { fields: FieldInfo[]; alignment: number; nextOffset: number } {
    // Handle arrays: ['array', type, length]
    if (Array.isArray(typeSpec)) {
      return this._processArray(name, typeSpec, offset, path);
    }

    // Handle nested structs: { field: type, ... }
    if (typeof typeSpec === 'object' && typeSpec !== null) {
      // (Explicit cast because TypeScript isn't narrowing Array exclusion properly here)
      return this._processNestedStruct(typeSpec as StructLayout, offset, path);
    }

    // Handle primitive types: 'vec3f', 'f32', etc.
    if (typeof typeSpec === 'string') {
      return this._processPrimitive(name, typeSpec, offset, path);
    }

    throw new Error(`Invalid type specification for field: ${name}`);
  }

  /**
   * Process a primitive type field
   */
  private _processPrimitive(
    name: string,
    type: string,
    offset: number,
    path: string[]
  ): { fields: FieldInfo[]; alignment: number; nextOffset: number } {
    const typeInfo = WebGPUStruct.TYPES[type as keyof typeof WebGPUStruct.TYPES];
    if (!typeInfo) {
      throw new Error(`Unknown type: ${type}`);
    }

    const [size, alignment, componentCount] = typeInfo;

    // Apply alignment padding
    const alignmentPadding = (alignment - (offset % alignment)) % alignment;
    offset += alignmentPadding;

    const field: FieldInfo = {
      name,
      type,
      offset,
      size,
      alignment,
      componentCount,
      path,
    };

    return {
      fields: [field],
      alignment,
      nextOffset: offset + size,
    };
  }

  /**
 * Process a nested struct field
 */
  private _processNestedStruct(
    structLayout: StructLayout,
    offset: number,
    path: string[]
  ): { fields: FieldInfo[]; alignment: number; nextOffset: number } {
    let nestedOffset = 0;
    let maxAlignment = 0;
    const fields: FieldInfo[] = [];

    // Process each field in the nested struct
    for (const [fieldName, fieldSpec] of Object.entries(structLayout)) {
      const result = this._processField(
        fieldName,
        fieldSpec,
        nestedOffset,
        [...path, fieldName]  // Pass down the accumulated path
      );

      maxAlignment = Math.max(maxAlignment, result.alignment);
      nestedOffset = result.nextOffset;
      fields.push(...result.fields);
    }

    // Align offset to the struct's alignment requirement
    const structAlignment = maxAlignment;
    const alignmentPadding = (structAlignment - (offset % structAlignment)) % structAlignment;
    offset += alignmentPadding;

    const baseOffset = offset;

    // Adjust all field offsets to be relative to the parent struct
    const adjustedFields = fields.map(field => ({
      ...field,
      offset: baseOffset + field.offset,
    }));

    // Calculate the total size of this nested struct
    const structSize = nestedOffset;
    // Align the struct size to its alignment
    const sizePadding = (structAlignment - (structSize % structAlignment)) % structAlignment;
    const totalStructSize = structSize + sizePadding;

    return {
      fields: adjustedFields,
      alignment: structAlignment,
      nextOffset: baseOffset + totalStructSize,
    };
  }

  /**
 * Process an array field
 * Arrays in WGSL have specific alignment rules:
 * - Array stride must be aligned to the element's alignment (minimum 16 bytes for struct arrays)
 * - Array itself aligns to the element's alignment
 * - First element has no extra padding beyond element alignment
 */
  private _processArray(
    name: string,
    arraySpec: [WebGPUStruct | StructLayout, number],
    offset: number,
    path: string[]
  ): { fields: FieldInfo[]; alignment: number; nextOffset: number } {
    const [elementSpec, length] = arraySpec;

    if (length <= 0) {
      throw new Error(`Array length must be positive: ${name}`);
    }

    let elementStruct: WebGPUStruct;
    let elementSize: number;
    let elementAlignment: number;

    // Determine element type
    if (elementSpec instanceof WebGPUStruct) {
      elementStruct = elementSpec;
      elementSize = elementStruct.totalSize;
      elementAlignment = Math.max(...elementStruct.fields.map(f => f.alignment));
    } else if (typeof elementSpec === 'object') {
      // Nested struct definition - create without uniform buffer rules
      elementStruct = new WebGPUStruct(elementSpec, { uniformBuffer: false });
      elementSize = elementStruct.totalSize;
      elementAlignment = Math.max(...elementStruct.fields.map(f => f.alignment));
    } else {
      throw new Error(`Invalid array element specification for: ${name}`);
    }

    // Array alignment is the element's alignment
    const arrayAlignment = elementAlignment;

    // Align the array start to element alignment (NOT 16!)
    const alignmentPadding = (arrayAlignment - (offset % arrayAlignment)) % arrayAlignment;
    offset += alignmentPadding;

    // Calculate array stride
    // For struct elements: stride must be a multiple of the element's alignment, minimum 16
    // For primitive elements: stride equals element size (aligned to element alignment)
    let arrayStride: number;

    // Structs in arrays need minimum 16-byte stride
    arrayStride = Math.max(elementSize, 16);
    // Align stride to element alignment
    arrayStride = Math.ceil(arrayStride / arrayAlignment) * arrayAlignment;

    const fields: FieldInfo[] = [];
    const baseOffset = offset;

    // Create fields for each array element
    for (let i = 0; i < length; i++) {
      const elementOffset = baseOffset + (i * arrayStride);

      // Add fields for this array element
      elementStruct.fields.forEach(elementField => {
        fields.push({
          ...elementField,
          name: `${name}.${i}.${elementField.name}`,
          offset: elementOffset + elementField.offset,
          path: [...path, `${i}`, elementField.name],
          isArray: true,
          arrayLength: length,
          arrayStride: arrayStride,
        });
      });
    }

    const totalArraySize = arrayStride * length;

    return {
      fields,
      alignment: arrayAlignment, // Return element alignment, not 16!
      nextOffset: baseOffset + totalArraySize,
    };
  }

  /**
   * Set a field value (supports nested access via dot notation or array)
   * @param path - Field path like 'camera.position' or ['lights', 0, 'color']
   * @param value - Value to set
   */
  set(path: string | string[], value: number | number[] | Float32Array | Int32Array | Uint32Array): this {
    const pathArray = typeof path === 'string' ? path.split('.') : path;
    const key = pathArray.join('.');

    const field = this.fieldMap.get(key);
    if (!field) {
      throw new Error(`Unknown field: ${key}`);
    }

    const isFloat = field.type.includes('f');
    const isInt = field.type.includes('i') && !field.type.includes('u');
    const isUint = field.type.includes('u');

    if (field.componentCount === 1) {
      // Scalar value
      if (typeof value !== 'number') {
        throw new Error(`Expected scalar value for ${key}`);
      }

      if (isFloat) {
        this.view.setFloat32(field.offset, value, true);
      } else if (isInt) {
        this.view.setInt32(field.offset, value, true);
      } else if (isUint) {
        this.view.setUint32(field.offset, value, true);
      }
    } else {
      // Vector or matrix
      if (typeof value === 'number') {
        throw new Error(`Expected vector/matrix value for ${key}, received "${value}"`);
      }

      const values = Array.isArray(value) ? value : Array.from(value);

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
   * Get a field value (supports nested access)
   * @param path - Field path like 'camera.position' or ['lights', 0, 'color']
   */
  get(path: string | string[]): number | Float32Array | Int32Array | Uint32Array {
    const pathArray = typeof path === 'string' ? path.split('.') : path;
    const key = pathArray.join('.');

    const field = this.fieldMap.get(key);
    if (!field) {
      throw new Error(`Unknown field: ${key}`);
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

    throw new Error(`Unable to get value for field: ${key}`);
  }

  /**
   * Set multiple fields at once (supports nested objects)
   */
  setAll(values: any): this {
    this._setAllRecursive(values, []);
    return this;
  }

  private _setAllRecursive(values: any, path: string[]) {
    for (const [key, value] of Object.entries(values)) {
      const currentPath = [...path, key];

      const isNumericArray = Array.isArray(value) && typeof value[0] === 'number';

      if (typeof value === 'object' && !isNumericArray && !(value instanceof Float32Array) && !(value instanceof Int32Array) && !(value instanceof Uint32Array)) {
        // Check if this is an array index pattern
        if (/^\d+$/.test(key)) {
          // This is an array index, continue recursing
          this._setAllRecursive(value, currentPath);
        } else {
          // Check if this path exists as a field (non-nested)
          const pathKey = currentPath.join('.');
          if (this.fieldMap.has(pathKey)) {
            this.set(currentPath, value as number | number[] | Float32Array | Int32Array | Uint32Array);
          } else {
            // Continue recursing for nested objects
            this._setAllRecursive(value, currentPath);
          }
        }
      } else {
        // Leaf value, set it
        this.set(currentPath, value as number | number[] | Float32Array | Int32Array | Uint32Array);
      }
    }
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
   * Copy data to a target buffer
   */
  copyTo(target: Uint8Array | ArrayBuffer, targetOffset = 0) {
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
  getLayoutInfo(): FieldInfo[] {
    return this.fields.map(f => ({ ...f }));
  }

  /**
   * Print layout for debugging
   */
  printLayout() {
    console.log(`Struct Layout (total size: ${this.totalSize} bytes):`);
    console.log('─'.repeat(80));

    let lastOffset = 0;
    let lastSize = 0;

    for (const field of this.fields) {
      const padding = field.offset - lastOffset - lastSize;

      if (padding > 0) {
        console.log(`  [padding: ${padding} bytes]`);
      }

      const indent = '  ' + '  '.repeat(field.path.length - 1);
      const fieldName = field.path.join('.');
      const arrayInfo = field.isArray ? ` (stride: ${field.arrayStride})` : '';

      console.log(
        `${indent}${fieldName.padEnd(30)} ${field.type.padEnd(10)} ` +
        `offset: ${field.offset.toString().padStart(4)}, ` +
        `size: ${field.size.toString().padStart(2)}` +
        arrayInfo
      );

      lastOffset = field.offset;
      lastSize = field.size;
    }

    const finalPadding = this.totalSize - lastOffset - lastSize;
    if (finalPadding > 0) {
      console.log(`  [final padding: ${finalPadding} bytes]`);
    }

    console.log('─'.repeat(80));
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
  clone(): WebGPUStruct {
    const cloned = new WebGPUStruct(this.layout, { uniformBuffer: this.uniformBuffer });
    cloned.float32View.set(this.float32View);
    return cloned;
  }
}
