import { describe, it, expect } from 'vitest';
import { WebGPUStruct } from '../utils/WebGPUStruct';

describe('WebGPUStruct', () => {
  describe('Basic Types', () => {
    it('should handle scalar types with correct size and alignment', () => {
      const struct = new WebGPUStruct({
        a: 'f32',
        b: 'i32',
        c: 'u32',
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[0].size).toBe(4);
      expect(layout[1].offset).toBe(4);
      expect(layout[1].size).toBe(4);
      expect(layout[2].offset).toBe(8);
      expect(layout[2].size).toBe(4);
      expect(struct.totalSize).toBe(12); // Aligned to 4 bytes (max alignment)
    });

    it('should handle scalar types with uniform buffer alignment', () => {
      const struct = new WebGPUStruct(
        {
          a: 'f32',
          b: 'i32',
          c: 'u32',
        },
        { uniformBuffer: true }
      );

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(4);
      expect(layout[2].offset).toBe(8);
      expect(struct.totalSize).toBe(16); // Uniform buffer: min 16-byte alignment
    });
  });

  describe('Vec2 Types', () => {
    it('should have 8-byte alignment', () => {
      const struct = new WebGPUStruct({
        a: 'f32', // offset: 0, size: 4
        b: 'vec2f', // offset: 8 (aligned), size: 8
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(8);
      expect(layout[1].size).toBe(8);
      expect(struct.totalSize).toBe(16); // Aligned to 8 bytes
    });

    it('should handle multiple vec2s', () => {
      const struct = new WebGPUStruct({
        a: 'vec2f', // offset: 0, size: 8
        b: 'vec2f', // offset: 8, size: 8
        c: 'vec2f', // offset: 16, size: 8
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(8);
      expect(layout[2].offset).toBe(16);
      expect(struct.totalSize).toBe(24); // Aligned to 8 bytes
    });
  });

  describe('Vec3 Types', () => {
    it('should have 16-byte alignment', () => {
      const struct = new WebGPUStruct({
        a: 'f32', // offset: 0, size: 4
        b: 'vec3f', // offset: 16 (aligned), size: 12
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(16);
      expect(layout[1].size).toBe(12);
      expect(struct.totalSize).toBe(32); // Aligned to 16 bytes (12 + 4 padding)
    });

    it('should maintain 16-byte alignment for multiple vec3s', () => {
      const struct = new WebGPUStruct({
        a: 'vec3f', // offset: 0, size: 12
        b: 'vec3f', // offset: 16, size: 12
        c: 'vec3f', // offset: 32, size: 12
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(16);
      expect(layout[2].offset).toBe(32);
      expect(struct.totalSize).toBe(48); // Aligned to 16 bytes
    });

    it('should handle vec3 with following scalar', () => {
      const struct = new WebGPUStruct({
        position: 'vec3f', // offset: 0, size: 12
        intensity: 'f32', // offset: 12, size: 4
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[0].size).toBe(12);
      expect(layout[1].offset).toBe(12);
      expect(layout[1].size).toBe(4);
      expect(struct.totalSize).toBe(16); // Aligned to 16 bytes
    });
  });

  describe('Vec4 Types', () => {
    it('should have 16-byte alignment', () => {
      const struct = new WebGPUStruct({
        a: 'vec4f', // offset: 0, size: 16
        b: 'f32', // offset: 16, size: 4
        c: 'vec4f', // offset: 32 (aligned), size: 16
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(16);
      expect(layout[2].offset).toBe(32);
      expect(struct.totalSize).toBe(48); // Aligned to 16 bytes
    });
  });

  describe('Matrix Types', () => {
    it('should have 16-byte alignment for mat4x4f', () => {
      const struct = new WebGPUStruct({
        a: 'f32', // offset: 0, size: 4
        b: 'mat4x4f', // offset: 16, size: 64 (16-byte aligned)
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(16);
      expect(layout[1].size).toBe(64);
      expect(struct.totalSize).toBe(80); // Aligned to 16 bytes
    });

    it('should handle mat3x3f alignment', () => {
      const struct = new WebGPUStruct({
        transform: 'mat3x3f', // offset: 0, size: 48
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[0].size).toBe(48);
      expect(struct.totalSize).toBe(48); // Aligned to 16 bytes
    });

    it('should handle mat2x2f alignment', () => {
      const struct = new WebGPUStruct({
        rotation: 'mat2x2f', // offset: 0, size: 16
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[0].size).toBe(16);
      expect(struct.totalSize).toBe(16); // Aligned to 8 bytes
    });
  });

  describe('Complex Struct Layouts', () => {
    it('should handle tightly packed scalars', () => {
      const struct = new WebGPUStruct({
        a: 'f32', // offset: 0
        b: 'f32', // offset: 4
        c: 'f32', // offset: 8
        d: 'f32', // offset: 12
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(4);
      expect(layout[2].offset).toBe(8);
      expect(layout[3].offset).toBe(12);
      expect(struct.totalSize).toBe(16); // Aligned to 4 bytes
    });

    it('should handle mixed types with various alignments', () => {
      const struct = new WebGPUStruct({
        a: 'f32', // offset: 0, size: 4
        b: 'vec2f', // offset: 8, size: 8 (8-byte aligned)
        c: 'f32', // offset: 16, size: 4
        d: 'vec3f', // offset: 32, size: 12 (16-byte aligned)
        e: 'f32', // offset: 44, size: 4
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(8);
      expect(layout[2].offset).toBe(16);
      expect(layout[3].offset).toBe(32);
      expect(layout[4].offset).toBe(44);
      expect(struct.totalSize).toBe(48); // Aligned to 16 bytes
    });

    it('should handle real-world material struct', () => {
      const material = new WebGPUStruct({
        albedo: 'vec4f', // offset: 0, size: 16
        roughness: 'f32', // offset: 16, size: 4
        metallic: 'f32', // offset: 20, size: 4
        emissive: 'vec3f', // offset: 32, size: 12 (16-byte aligned!)
        normalScale: 'f32', // offset: 44, size: 4
        flags: 'u32', // offset: 48, size: 4
      });

      const layout = material.getLayoutInfo();
      expect(layout[0].offset).toBe(0); // albedo
      expect(layout[1].offset).toBe(16); // roughness
      expect(layout[2].offset).toBe(20); // metallic
      expect(layout[3].offset).toBe(32); // emissive (16-byte aligned)
      expect(layout[4].offset).toBe(44); // normalScale
      expect(layout[5].offset).toBe(48); // flags
      expect(material.totalSize).toBe(64); // Aligned to 16 bytes (52 + 12 padding)
    });
  });

  describe('Uniform Buffer Alignment', () => {
    it('should enforce minimum 16-byte alignment for uniform buffers', () => {
      const struct = new WebGPUStruct(
        {
          value: 'f32', // 4 bytes
        },
        { uniformBuffer: true }
      );

      expect(struct.totalSize).toBe(16); // Minimum 16-byte alignment
    });

    it('should use larger alignment when member requires it', () => {
      const struct = new WebGPUStruct(
        {
          a: 'vec2f', // 8-byte alignment
          b: 'f32',
        },
        { uniformBuffer: true }
      );

      expect(struct.totalSize).toBe(16); // 16-byte minimum enforced
    });

    it('should not add extra padding when already 16-byte aligned', () => {
      const struct = new WebGPUStruct(
        {
          a: 'vec4f', // 16-byte alignment, 16 bytes
        },
        { uniformBuffer: true }
      );

      expect(struct.totalSize).toBe(16); // Already 16-byte aligned
    });

    it('should handle complex uniform buffer struct', () => {
      const struct = new WebGPUStruct(
        {
          modelMatrix: 'mat4x4f', // offset: 0, size: 64
          normalMatrix: 'mat3x3f', // offset: 64, size: 48
          color: 'vec4f', // offset: 112, size: 16
        },
        { uniformBuffer: true }
      );

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(64);
      expect(layout[2].offset).toBe(112);
      expect(struct.totalSize).toBe(128); // Aligned to 16 bytes
    });
  });

  describe('Integer Vector Types', () => {
    it('should handle vec2i with correct alignment', () => {
      const struct = new WebGPUStruct({
        indices: 'vec2i',
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].size).toBe(8);
      expect(layout[0].alignment).toBe(8);
    });

    it('should handle vec3u with 16-byte alignment', () => {
      const struct = new WebGPUStruct({
        coords: 'vec3u',
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].size).toBe(12);
      expect(layout[0].alignment).toBe(16);
    });

    it('should handle vec4i with correct alignment', () => {
      const struct = new WebGPUStruct({
        data: 'vec4i',
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].size).toBe(16);
      expect(layout[0].alignment).toBe(16);
    });
  });

  describe('Get/Set Operations', () => {
    it('should set and get scalar values', () => {
      const struct = new WebGPUStruct({
        intensity: 'f32',
        count: 'i32',
        flags: 'u32',
      });

      struct.set('intensity', 0.75);
      struct.set('count', -42);
      struct.set('flags', 255);

      expect(struct.get('intensity')).toBeCloseTo(0.75, 5);
      expect(struct.get('count')).toBe(-42);
      expect(struct.get('flags')).toBe(255);
    });

    it('should set and get vector values', () => {
      const struct = new WebGPUStruct({
        color: 'vec4f',
        position: 'vec3f',
        uv: 'vec2f',
      });

      struct.set('color', [1.0, 0.5, 0.25, 1.0]);
      struct.set('position', [10, 20, 30]);
      struct.set('uv', [0.5, 0.75]);

      const color = struct.get('color');
      const position = struct.get('position');
      const uv = struct.get('uv');

      expect(color).toHaveLength(4);
      expect(color[0]).toBeCloseTo(1.0, 5);
      expect(color[3]).toBeCloseTo(1.0, 5);

      expect(position).toHaveLength(3);
      expect(position[1]).toBeCloseTo(20, 5);

      expect(uv).toHaveLength(2);
      expect(uv[0]).toBeCloseTo(0.5, 5);
    });

    it('should accept TypedArray values', () => {
      const struct = new WebGPUStruct({
        color: 'vec4f',
      });

      const colorArray = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      struct.set('color', colorArray);

      const result = struct.get('color');
      expect(result[0]).toBeCloseTo(0.1, 5);
      expect(result[3]).toBeCloseTo(0.4, 5);
    });

    it('should handle integer vectors correctly', () => {
      const struct = new WebGPUStruct({
        indices: 'vec2i',
        coords: 'vec3u',
      });

      struct.set('indices', [-5, 10]);
      struct.set('coords', [1, 2, 3]);

      const indices = struct.get('indices');
      const coords = struct.get('coords');

      expect(indices[0]).toBe(-5);
      expect(indices[1]).toBe(10);
      expect(coords[0]).toBe(1);
      expect(coords[2]).toBe(3);
    });
  });

  describe('Bulk Operations', () => {
    it('should set multiple fields with setAll', () => {
      const struct = new WebGPUStruct({
        a: 'f32',
        b: 'vec3f',
        c: 'u32',
      });

      struct.setAll({
        a: 5.5,
        b: [1, 2, 3],
        c: 100,
      });

      expect(struct.get('a')).toBeCloseTo(5.5, 5);
      expect(struct.get('b')[0]).toBeCloseTo(1, 5);
      expect(struct.get('c')).toBe(100);
    });

    it('should support method chaining', () => {
      const struct = new WebGPUStruct({
        a: 'f32',
        b: 'f32',
      });

      const result = struct.set('a', 1).set('b', 2);
      expect(result).toBe(struct);
      expect(struct.get('a')).toBeCloseTo(1, 5);
      expect(struct.get('b')).toBeCloseTo(2, 5);
    });
  });

  describe('Buffer Operations', () => {
    it('should provide ArrayBuffer access', () => {
      const struct = new WebGPUStruct({
        value: 'f32',
      });

      struct.set('value', 42.5);
      const buffer = struct.getArrayBuffer();
      const view = new Float32Array(buffer);

      expect(view[0]).toBeCloseTo(42.5, 5);
    });

    it('should provide Uint8Array access', () => {
      const struct = new WebGPUStruct({
        value: 'f32',
      });

      struct.set('value', 1.0);
      const uint8 = struct.getUint8Array();

      expect(uint8).toBeInstanceOf(Uint8Array);
      expect(uint8.byteLength).toBe(struct.totalSize);
    });

    it('should copy to target buffer', () => {
      const struct = new WebGPUStruct({
        value: 'f32',
      });

      struct.set('value', 123.45);

      const target = new ArrayBuffer(16);
      struct.copyTo(target, 4);

      const view = new Float32Array(target);
      expect(view[1]).toBeCloseTo(123.45, 5);
    });

    it('should copy to Uint8Array target', () => {
      const struct = new WebGPUStruct({
        value: 'f32',
      });

      struct.set('value', 99.9);

      const target = new Uint8Array(16);
      struct.copyTo(target, 0);

      const view = new Float32Array(target.buffer);
      expect(view[0]).toBeCloseTo(99.9, 5);
    });
  });

  describe('Utility Methods', () => {
    it('should reset all values to zero', () => {
      const struct = new WebGPUStruct({
        a: 'f32',
        b: 'vec3f',
      });

      struct.set('a', 10).set('b', [1, 2, 3]);
      struct.reset();

      expect(struct.get('a')).toBe(0);
      expect(struct.get('b')[0]).toBe(0);
      expect(struct.get('b')[2]).toBe(0);
    });

    it('should clone struct with independent data', () => {
      const struct1 = new WebGPUStruct({
        value: 'f32',
      });

      struct1.set('value', 100);
      const struct2 = struct1.clone();

      expect(struct2.get('value')).toBeCloseTo(100, 5);

      struct1.set('value', 200);
      expect(struct1.get('value')).toBeCloseTo(200, 5);
      expect(struct2.get('value')).toBeCloseTo(100, 5);
    });

    it('should provide layout info', () => {
      const struct = new WebGPUStruct({
        a: 'f32',
        b: 'vec3f',
      });

      const layout = struct.getLayoutInfo();

      expect(layout).toHaveLength(2);
      expect(layout[0]).toHaveProperty('name', 'a');
      expect(layout[0]).toHaveProperty('type', 'f32');
      expect(layout[0]).toHaveProperty('offset');
      expect(layout[0]).toHaveProperty('size');
      expect(layout[0]).toHaveProperty('alignment');
    });
  });

  describe('Error Handling', () => {
    it('should throw on unknown field in set', () => {
      const struct = new WebGPUStruct({
        a: 'f32',
      });

      expect(() => {
        struct.set('nonexistent', 5);
      }).toThrow('Unknown field');
    });

    it('should throw on unknown field in get', () => {
      const struct = new WebGPUStruct({
        a: 'f32',
      });

      expect(() => {
        struct.get('nonexistent');
      }).toThrow('Unknown field');
    });

    it('should throw on wrong component count', () => {
      const struct = new WebGPUStruct({
        color: 'vec4f',
      });

      expect(() => {
        struct.set('color', [1, 2, 3]); // Only 3 components, needs 4
      }).toThrow('Expected 4 components');
    });

    it('should throw on unknown type', () => {
      expect(() => {
        new WebGPUStruct({
          invalid: 'vec5f' as any,
        });
      }).toThrow('Unknown type');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single field struct', () => {
      const struct = new WebGPUStruct({
        value: 'f32',
      });

      expect(struct.totalSize).toBe(4);
      struct.set('value', 42);
      expect(struct.get('value')).toBeCloseTo(42, 5);
    });

    it('should throw on empty struct', () => {
      expect(() => {
        new WebGPUStruct({});
      }).toThrow('Struct layout cannot be empty');
    });

    it('should handle maximum padding scenario', () => {
      const struct = new WebGPUStruct({
        a: 'f32', // offset: 0, size: 4
        b: 'f32', // offset: 4, size: 4
        c: 'f32', // offset: 8, size: 4
        d: 'vec3f', // offset: 16, size: 12 (needs 16-byte alignment, 4 bytes padding)
      });

      const layout = struct.getLayoutInfo();
      expect(layout[3].offset).toBe(16); // vec3f aligned to 16
      expect(struct.totalSize).toBe(32); // 28 bytes + 4 padding
    });

    it('should handle all scalar types together', () => {
      const struct = new WebGPUStruct({
        f: 'f32',
        i: 'i32',
        u: 'u32',
      });

      struct.set('f', 1.5);
      struct.set('i', -100);
      struct.set('u', 200);

      expect(struct.get('f')).toBeCloseTo(1.5, 5);
      expect(struct.get('i')).toBe(-100);
      expect(struct.get('u')).toBe(200);
    });

    it('should handle consecutive vectors of different types', () => {
      const struct = new WebGPUStruct({
        v2: 'vec2f', // offset: 0, size: 8
        v3: 'vec3f', // offset: 16, size: 12 (16-byte aligned)
        v4: 'vec4f', // offset: 32, size: 16 (16-byte aligned)
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[1].offset).toBe(16);
      expect(layout[2].offset).toBe(32);
      expect(struct.totalSize).toBe(48);
    });
  });

  describe('Alignment Verification', () => {
    it('should verify vec3 always gets 16-byte alignment', () => {
      // Test various positions where vec3 might appear
      const cases = [
        { layout: { a: 'f32', b: 'vec3f' }, expectedOffset: 16 },
        { layout: { a: 'vec2f', b: 'vec3f' }, expectedOffset: 16 },
        { layout: { a: 'f32', b: 'f32', c: 'vec3f' }, expectedOffset: 16 },
        { layout: { a: 'f32', b: 'f32', c: 'f32', d: 'vec3f' }, expectedOffset: 16 },
      ];

      cases.forEach(({ layout, expectedOffset }) => {
        const struct = new WebGPUStruct(layout);
        const info = struct.getLayoutInfo();
        const vec3Field = info.find((f) => f.type === 'vec3f');
        expect(vec3Field?.offset).toBe(expectedOffset);
      });
    });

    it('should verify struct size is always aligned to max member alignment', () => {
      const cases = [
        { layout: { a: 'f32' }, expectedSize: 4 }, // 4-byte alignment
        { layout: { a: 'vec2f' }, expectedSize: 8 }, // 8-byte alignment
        { layout: { a: 'vec3f' }, expectedSize: 16 }, // 16-byte alignment
        { layout: { a: 'vec4f' }, expectedSize: 16 }, // 16-byte alignment
        { layout: { a: 'f32', b: 'f32', c: 'f32' }, expectedSize: 12 }, // 4-byte alignment
        { layout: { a: 'vec2f', b: 'f32' }, expectedSize: 16 }, // 8-byte alignment (8+4+4 padding)
      ];

      cases.forEach(({ layout, expectedSize }) => {
        const struct = new WebGPUStruct(layout);
        expect(struct.totalSize).toBe(expectedSize);
      });
    });
  });

  describe('Nested Structs', () => {
    it('should handle simple nested struct', () => {
      const struct = new WebGPUStruct({
        camera: {
          position: 'vec3f',
          direction: 'vec3f',
        },
        time: 'f32',
      });

      const layout = struct.getLayoutInfo();

      // camera.position at offset 0
      expect(layout.find(f => f.path.join('.') === 'camera.position')?.offset).toBe(0);
      // camera.direction at offset 16 (vec3 aligned)
      expect(layout.find(f => f.path.join('.') === 'camera.direction')?.offset).toBe(16);
      // time after camera struct
      expect(layout.find(f => f.path.join('.') === 'time')?.offset).toBe(32);
    });

    it('should set and get nested struct values', () => {
      const struct = new WebGPUStruct({
        camera: {
          position: 'vec3f',
          fov: 'f32',
        },
      });

      struct.set('camera.position', [1, 2, 3]);
      struct.set('camera.fov', 90);

      const position = struct.get('camera.position');
      const fov = struct.get('camera.fov');

      expect(position[0]).toBeCloseTo(1, 5);
      expect(position[2]).toBeCloseTo(3, 5);
      expect(fov).toBeCloseTo(90, 5);
    });

    it('should handle deeply nested structs', () => {
      const struct = new WebGPUStruct({
        scene: {
          camera: {
            transform: {
              position: 'vec3f',
              rotation: 'vec3f',
            },
            fov: 'f32',
          },
        },
      });

      struct.set('scene.camera.transform.position', [10, 20, 30]);
      struct.set('scene.camera.fov', 75);

      const position = struct.get('scene.camera.transform.position');
      expect(position[1]).toBeCloseTo(20, 5);
    });

    it('should use setAll with nested objects', () => {
      const struct = new WebGPUStruct({
        light: {
          position: 'vec3f',
          color: 'vec3f',
          intensity: 'f32',
        },
      });

      struct.setAll({
        light: {
          position: [0, 10, 0],
          color: [1, 1, 1],
          intensity: 2.5,
        },
      });

      expect(struct.get('light.position')[1]).toBeCloseTo(10, 5);
      expect(struct.get('light.intensity')).toBeCloseTo(2.5, 5);
    });

    it('should handle deeply nested structs with correct offsets', () => {
      const struct = new WebGPUStruct({
        scene: {
          camera: {
            transform: {
              position: 'vec3f',  // offset: 0
              rotation: 'vec3f',  // offset: 16
            },
            fov: 'f32',          // offset: 32
          },
          lighting: {
            ambient: 'vec3f',    // offset: 48 (aligned to 16)
          },
        },
      });

      const layout = struct.getLayoutInfo();

      // Verify paths exist
      const position = layout.find(f => f.path.join('.') === 'scene.camera.transform.position');
      const rotation = layout.find(f => f.path.join('.') === 'scene.camera.transform.rotation');
      const fov = layout.find(f => f.path.join('.') === 'scene.camera.fov');
      const ambient = layout.find(f => f.path.join('.') === 'scene.lighting.ambient');

      expect(position).toBeDefined();
      expect(rotation).toBeDefined();
      expect(fov).toBeDefined();
      expect(ambient).toBeDefined();

      expect(position?.offset).toBe(0);
      expect(rotation?.offset).toBe(16);
      expect(fov?.offset).toBe(32);
      expect(ambient?.offset).toBe(48);

      // Verify we can set and get values
      struct.set('scene.camera.transform.position', [10, 20, 30]);
      struct.set('scene.camera.fov', 75);

      const posValue = struct.get('scene.camera.transform.position');
      expect(posValue[1]).toBeCloseTo(20, 5);
      expect(struct.get('scene.camera.fov')).toBeCloseTo(75, 5);
    });
  });

  describe('Array Fields', () => {
    it('should handle array of primitives', () => {
      const lightDef = new WebGPUStruct({
        position: 'vec3f',
        color: 'vec3f',
      });

      const struct = new WebGPUStruct({
        lights: [lightDef, 3],
      });

      // Arrays have minimum 16-byte stride
      const layout = struct.getLayoutInfo();
      const light0Pos = layout.find(f => f.path.join('.') === 'lights.0.position');
      const light1Pos = layout.find(f => f.path.join('.') === 'lights.1.position');

      expect(light0Pos?.offset).toBe(0);
      expect(light1Pos?.offset).toBeGreaterThanOrEqual(light0Pos!.offset + 16);
    });

    it('should set and get array values', () => {
      const pointDef = new WebGPUStruct({
        position: 'vec3f',
        size: 'f32',
      });

      const struct = new WebGPUStruct({
        points: [pointDef, 2],
      });

      struct.set(['points', '0', 'position'], [1, 2, 3]);
      struct.set(['points', '0', 'size'], 5);
      struct.set(['points', '1', 'position'], [4, 5, 6]);
      struct.set(['points', '1', 'size'], 10);

      const pos0 = struct.get(['points', '0', 'position']);
      const size1 = struct.get(['points', '1', 'size']);

      expect(pos0[0]).toBeCloseTo(1, 5);
      expect(size1).toBeCloseTo(10, 5);
    });

    it('should use setAll with arrays', () => {
      const lightDef = new WebGPUStruct({
        color: 'vec3f',
        intensity: 'f32',
      });

      const struct = new WebGPUStruct({
        lights: [lightDef, 2],
      });

      struct.setAll({
        lights: {
          0: {
            color: [1, 0, 0],
            intensity: 1.0,
          },
          1: {
            color: [0, 1, 0],
            intensity: 0.5,
          },
        },
      });

      expect(struct.get(['lights', '0', 'color'])[0]).toBeCloseTo(1, 5);
      expect(struct.get(['lights', '1', 'intensity'])).toBeCloseTo(0.5, 5);
    });

    it('should handle array with inline struct definition', () => {
      const struct = new WebGPUStruct({
        particles: [
          {
            position: 'vec3f',
            velocity: 'vec3f',
          },
          4,
        ],
      });

      struct.set(['particles', '2', 'velocity'], [1, 2, 3]);
      const velocity = struct.get(['particles', '2', 'velocity']);

      expect(velocity[0]).toBeCloseTo(1, 5);
    });

    it('should handle array alignment correctly when it\'s not the first field (webgpufundamentals example)', () => {
      // Reference: https://webgpufundamentals.org/webgpu/lessons/resources/wgsl-offset-computer.html
      const lightStruct = new WebGPUStruct({
        mode: 'u32',          // offset: 0
        power: 'f32',         // offset: 4
        range: 'f32',         // offset: 8
        innerAngle: 'f32',    // offset: 12
        outerAngle: 'f32',    // offset: 16
        direction: 'vec3f',   // offset: 32 (needs 16-byte alignment)
        position: 'vec3f',    // offset: 48
      });

      const fsInput = new WebGPUStruct({
        colorMult: 'vec4f',          // offset: 0-15
        specularFactor: 'f32',       // offset: 16-19
        lights: [lightStruct, 2],  // starts at offset: 20
      }, { uniformBuffer: true });

      const layout = fsInput.getLayoutInfo();

      // Verify array offsets
      expect(layout.find(f => f.path.join('.') === 'lights.0.mode')?.offset).toBe(32);
      expect(layout.find(f => f.path.join('.') === 'lights.0.power')?.offset).toBe(36);
      expect(layout.find(f => f.path.join('.') === 'lights.0.range')?.offset).toBe(40);
      expect(layout.find(f => f.path.join('.') === 'lights.0.innerAngle')?.offset).toBe(44);
      expect(layout.find(f => f.path.join('.') === 'lights.0.outerAngle')?.offset).toBe(48);
      expect(layout.find(f => f.path.join('.') === 'lights.0.direction')?.offset).toBe(64);
      expect(layout.find(f => f.path.join('.') === 'lights.0.position')?.offset).toBe(80);
      expect(layout.find(f => f.path.join('.') === 'lights.1.mode')?.offset).toBe(96);

      // Verify total size
      expect(fsInput.totalSize).toBe(160); // 80 bytes of data, rounded up to 16-byte alignment for uniform
      console.log(fsInput.printLayout());
    });

    it('should handle array alignment correctly when it\'s not the first field (wgsl spec ref, storage)', () => {
      const structA = new WebGPUStruct({ // align(8) size(24)
        u: 'f32',    // offset(0)   align(4)  size(4)
        v: 'f32',    // offset(4)   align(4)  size(4)
        w: 'vec2f',  // offset(8)   align(8)  size(8)
        x: 'f32'     // offset(16)  align(4)  size(4)
        // implicit struct size padding --   offset(20) size(4)
      });

      const structB = new WebGPUStruct({ //               align(16) size(160)
        a: 'vec2f',                        // offset(0)   align(8)  size(8)
        // implicit member alignment padding  offset(8)             size(8)
        b: 'vec3f',                        // offset(16)  align(16) size(12)
        c: 'f32',                          // offset(28)  align(4)  size(4)
        d: 'f32',                          // offset(32)  align(4)  size(4)
        // implicit member alignment padding  offset(36)            size(4)
        e: structA.layout,                 // offset(40)  align(8)  size(24)
        f: 'vec3f',                        // offset(64)  align(16) size(12)
        // implicit member alignment padding  offset(76)            size(4)
        g: [structA, 3], // element stride 24 offset(80)  align(8)  size(72)
        h: 'i32'                           // offset(152) align(4)  size(4)
        // implicit struct size padding       offset(156)           size(4)
      });
      const layout = structB.getLayoutInfo();

      console.log(structA.printLayout());

      // Verify array offsets
      expect(layout.find(f => f.path.join('.') === 'g.0.u')?.offset).toBe(80);
      expect(layout.find(f => f.path.join('.') === 'g.0.v')?.offset).toBe(84);
      expect(layout.find(f => f.path.join('.') === 'g.0.w')?.offset).toBe(88);
      expect(layout.find(f => f.path.join('.') === 'g.0.x')?.offset).toBe(96);
      expect(layout.find(f => f.path.join('.') === 'g.1.u')?.offset).toBe(104);
      expect(layout.find(f => f.path.join('.') === 'g.2.u')?.offset).toBe(128);

      // Verify total size
      expect(structB.totalSize).toBe(160); // 80 bytes of data, rounded up to 16-byte alignment for uniform
    });

    it('should enforce minimum 16-byte array stride', () => {
      // Small struct (vec3 = 12 bytes + 4 padding = 16)
      const struct = new WebGPUStruct({
        data: [
          {
            value: 'vec3f',
          },
          3,
        ],
      });

      const layout = struct.getLayoutInfo();
      const elem0 = layout.find(f => f.path.join('.') === 'data.0.value');
      const elem1 = layout.find(f => f.path.join('.') === 'data.1.value');

      const stride = elem1!.offset - elem0!.offset;
      expect(stride).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should handle scene with nested structs and arrays', () => {
      const struct = new WebGPUStruct({
        camera: {
          position: 'vec3f',
          direction: 'vec3f',
          fov: 'f32',
        },
        lights: [
          {
            position: 'vec3f',
            color: 'vec3f',
            intensity: 'f32',
          },
          4,
        ],
        ambientColor: 'vec3f',
        time: 'f32',
      });

      struct.setAll({
        camera: {
          position: [0, 5, 10],
          direction: [0, 0, -1],
          fov: 60,
        },
        lights: {
          0: {
            position: [10, 10, 10],
            color: [1, 1, 1],
            intensity: 2.0,
          },
          1: {
            position: [-10, 10, 10],
            color: [1, 0.8, 0.6],
            intensity: 1.5,
          },
        },
        ambientColor: [0.1, 0.1, 0.15],
        time: 0,
      });

      expect(struct.get('camera.fov')).toBeCloseTo(60, 5);
      expect(struct.get(['lights', '1', 'intensity'])).toBeCloseTo(1.5, 5);
      expect(struct.get('ambientColor')[2]).toBeCloseTo(0.15, 5);
    });

    it('should handle particle system struct', () => {
      const struct = new WebGPUStruct({
        particles: [
          {
            position: 'vec3f',
            velocity: 'vec3f',
            life: 'f32',
            size: 'f32',
          },
          100,
        ],
        emitter: {
          position: 'vec3f',
          rate: 'f32',
        },
      });

      expect(struct.totalSize).toBeGreaterThan(0);

      struct.set(['particles', '50', 'life'], 1.0);
      expect(struct.get(['particles', '50', 'life'])).toBeCloseTo(1.0, 5);
    });
  });

  describe('Error Handling for Complex Types', () => {
    it('should throw on invalid array length', () => {
      expect(() => {
        new WebGPUStruct({
          data: [{ value: 'f32' }, 0],
        });
      }).toThrow('Array length must be positive');
    });

    it('should throw on invalid array element spec', () => {
      expect(() => {
        new WebGPUStruct({
          data: ['invalid' as any, 4],
        });
      }).toThrow('Invalid array element specification');
    });

    it('should throw on accessing non-existent nested field', () => {
      const struct = new WebGPUStruct({
        camera: {
          position: 'vec3f',
        },
      });

      expect(() => {
        struct.get('camera.invalid');
      }).toThrow('Unknown field');
    });

    it('should throw on accessing non-existent array index', () => {
      const struct = new WebGPUStruct({
        data: [{ value: 'f32' }, 2],
      });

      expect(() => {
        struct.get(['data', '5', 'value']);
      }).toThrow('Unknown field');
    });
  });
});
