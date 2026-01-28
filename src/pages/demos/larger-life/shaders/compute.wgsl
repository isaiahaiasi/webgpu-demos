/*
Consts prepended in JavaScript module:
- BOARD : vec2i
- WORKGROUP_SIZE : u32
*/

struct Rules {
    includeSelf: i32,
    neighborDistance: i32,
    birthRange: vec2f,
    survivalRange: vec2f,
}


@group(0) @binding(0) var computeTextureSrc: texture_storage_2d<r32uint, read>;
@group(0) @binding(1) var computeTextureDst: texture_storage_2d<r32uint, read_write>;
@group(0) @binding(2) var<uniform> rules: Rules;


@compute @workgroup_size(
    WORKGROUP_SIZE,
    WORKGROUP_SIZE,
    1
) fn main(@builtin(global_invocation_id) id : vec3u) {
    let idx = id.xy;
    var neighborCount : u32 = 0u;

    for (var y: i32 = -rules.neighborDistance; y <= rules.neighborDistance; y+= 1) {
        for (var x: i32 = -rules.neighborDistance; x <= rules.neighborDistance; x+= 1) {
            if (x == 0 && y == 0) {
                continue;
            }

            let coord = vec2i(idx) + vec2i(x, y);
            let neighborIdx = vec2u((coord + BOARD) % BOARD);

            neighborCount += textureLoad(computeTextureSrc, neighborIdx).x;
        }
    }

    let cur_state = textureLoad(computeTextureSrc, idx).x;

    if (rules.includeSelf == 1) {
        neighborCount += cur_state;
    }

    let neighborhoodWidth = f32(rules.neighborDistance * 2 + 1);
    let density = f32(neighborCount) / (neighborhoodWidth * neighborhoodWidth);

    var new_state : u32;

    if (cur_state == 1u) {
        if (density >= rules.survivalRange.x && density <= rules.survivalRange.y) {
            new_state = 1u;
        } else {
            new_state = 0u;
        }
    } else {
        if (density >= rules.birthRange.x && density <= rules.birthRange.y) {
            new_state = 1u;
        } else {
            new_state = 0u;
        }
    }

    textureStore(computeTextureDst, idx, vec4u(new_state, 0u, 0u, 0u));
}
