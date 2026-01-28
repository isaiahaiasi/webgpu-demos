/*
Consts prepended in JavaScript module:
- BOARD : vec2i
- WORKGROUP_SIZE : u32
- BIRTH_MAP : array<u32, 9>
- SURVIVAL_MAP : array<u32, 9>
*/

/*
<rule>_MAP[neighbor_count] = new_state
<rule>_MAP.length = max neighbor count + 1, ie 9

EXAMPLE:
B4678/S35678 ("Anneal" rulestring)
const BIRTH_MAP: array<u32, 9> =    array(0, 0, 0, 0, 1, 0, 1, 1, 1);
const SURVIVAL_MAP: array<u32, 9> = array(0, 0, 0, 1, 0, 1, 1, 1, 1);
*/

@group(0) @binding(0) var computeTextureSrc: texture_storage_2d<r32uint, read>;
@group(0) @binding(1) var computeTextureDst: texture_storage_2d<r32uint, read_write>;


@compute @workgroup_size(
    WORKGROUP_SIZE,
    WORKGROUP_SIZE,
    1
) fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    let idx = id.xy;
    var neighborCount : u32 = 0u;

    for (var y: i32 = -1; y <= 1; y+= 1) {
        for (var x: i32 = -1; x <= 1; x+= 1) {
            if (x == 0 && y == 0) {
                continue;
            }
            let neighborY = (i32(id.y) + y + BOARD.y) % BOARD.y;
            let neighborX = (i32(id.x) + x + BOARD.x) % BOARD.x;
            let neighborIdx = vec2<u32>(u32(neighborX), u32(neighborY));
            neighborCount += textureLoad(computeTextureSrc, neighborIdx).x;
        }
    }

    let cur_state = textureLoad(computeTextureSrc, idx).x;
    let new_state = select(
        SURVIVAL_MAP[neighborCount],
        BIRTH_MAP[neighborCount],
        cur_state != 1u);

    textureStore(computeTextureDst, idx, vec4<u32>(new_state, 0u, 0u, 0u));
}