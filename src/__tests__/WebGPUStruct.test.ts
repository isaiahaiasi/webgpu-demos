import { describe, it, expect } from 'vitest';
import { WebGPUStruct, type WGSLType } from '../utils/WebGPUStruct';

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
    it('should match webgpufundamentals example', () => {
      // https://webgpufundamentals.org/webgpu/lessons/resources/wgsl-offset-computer.html
      const struct = new WebGPUStruct({
        scale: 'f32', // offset: 0, size: 4
        offset: 'vec3f', // offset: 16, size: 12 (16-byte aligned)
        matrix: 'mat4x4f', // offset: 32, size: 64 (16-byte aligned)
      });

      const layout = struct.getLayoutInfo();
      expect(layout[0].offset).toBe(0);
      expect(layout[0].size).toBe(4);
      expect(layout[1].offset).toBe(16);
      expect(layout[1].size).toBe(12);
      expect(layout[2].offset).toBe(32);
      expect(layout[2].size).toBe(64);
      expect(struct.totalSize).toBe(96);
    });

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
        // @ts-expect-error
        struct.set('nonexistent', 5);
      }).toThrow('Unknown field');
    });

    it('should throw on unknown field in get', () => {
      const struct = new WebGPUStruct({
        a: 'f32',
      });

      expect(() => {
        // @ts-expect-error
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
        const struct = new WebGPUStruct(layout as Record<string, WGSLType>);
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
        const struct = new WebGPUStruct(layout as Record<string, WGSLType>);
        expect(struct.totalSize).toBe(expectedSize);
      });
    });
  });
});
