export function getRenderShader({ scaleX, scaleY, width, height }) {
    return /* wgsl */`
const BOARD = vec2u(${width}u, ${height}u);
const SCALE = vec2f(${scaleX}f, ${scaleY}f);

struct VSOut {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f
};

struct Colors {
    aliveCol: vec4f, // w component unused, but padding requires vec4
    deadCol: vec4f,
};

@group(0) @binding(0) var renderTexture: texture_storage_2d<r32uint, read>;
@group(0) @binding(1) var<uniform> colors: Colors;


@vertex
fn vs(@builtin(vertex_index) vidx : u32) -> VSOut {
    var out : VSOut;
    let quad = array<vec2f, 6>(
        vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
        vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
    );
    let v = quad[vidx];
    // Scale quad to preserve aspect ratio, then convert to clip space
    let scaled = v * SCALE;
    out.pos = vec4f(scaled, 0.0, 1.0);
    // Map scaled clip space back to [0, 1] for sampling
    // scaled is in [-scaleX, scaleX] × [-scaleY, scaleY]
    // center it and clamp to board area
    let centered = (scaled + SCALE) / (SCALE * 2.0);
    out.uv = centered;
    out.uv.y = 1.0 - out.uv.y;
    return out;
}


@fragment
fn fs(@location(0) uv : vec2f) -> @location(0) vec4f {
    let cell = vec2u(uv * vec2f(BOARD));
    let cellState = textureLoad(renderTexture, cell).x;
    if (cellState == 1u) {
        return vec4f(colors.aliveCol.xyz, 1.0);
    }
    return vec4f(colors.deadCol.xyz, 1.0);
}`
}

type Neighborhood = {
    shape: 'CIRCLE' | 'SQUARE'; // TODO: von neumann
    minDist: number;
    maxDist: number;
}
type ComputeShaderParams = {
    width: number;
    height: number;
    workGroupSize: number;
    neighborhoods: Neighborhood[];
}

export const MAX_RULE_SIZE = 16;

export function getComputeShader(
    { width, height, workGroupSize, neighborhoods }: ComputeShaderParams
) {
    return /* wgsl */`
const BOARD = vec2i(${width}, ${height});
const WORKGROUP_SIZE : u32 = ${workGroupSize}u;


struct RuleSet {
    // vec3f represents:
    // x:   positive: life; negative: death; > 999 = not defined (end of defined rules)
    // y,z: described range
    // (padded to vec4 for alignment)
    rules: array<vec3f, ${MAX_RULE_SIZE}>,
};

@group(0) @binding(0) var computeTextureSrc: texture_storage_2d<r32uint, read>;
@group(0) @binding(1) var computeTextureDst: texture_storage_2d<r32uint, read_write>;

// Array must have stride multiple of 16 bytes.
@group(0) @binding(2) var<uniform> neighborhoods: array<RuleSet, ${neighborhoods.length}>;


fn searchSquare(minDist: i32, maxDist: i32, idx: vec2<u32>) -> f32 {
    var neighborCount : u32 = 0u;

    for (var y: i32 = -maxDist; y <= maxDist; y+= 1) {
        for (var x: i32 = -maxDist; x <= maxDist; x+= 1) {
            if ( abs(x) < minDist || abs(y) < minDist) {
                continue;
            }

            let coord = vec2i(idx) + vec2i(x, y);
            let neighborIdx = vec2u((coord + BOARD) % BOARD);

            neighborCount += textureLoad(computeTextureSrc, neighborIdx).x;
        }
    }

    let neighborhoodWidth = f32(maxDist * 2 + 1);
    let neighborhoodArea = neighborhoodWidth * neighborhoodWidth;
    let subArea = f32((minDist * 2 - 1) * (minDist * 2 - 1));
    return f32(neighborCount) / (neighborhoodArea - subArea);
}

fn searchNeumann(minDist: i32, maxDist: i32, id: vec2<u32>) -> f32 {
    // TODO von neumann with min dist
    // for (var yOffset = -maxDist; yOffset <= maxDist; yOffset += 1) {
    // let x_search = maxDist - abs(yOffset);
    //     for (var xOffset = -x_search; xOffset <= x_search; xOffset += 1) {
    //         if (xOffset == 0 && yOffset == 0) { continue; }
    //         var x = wrapCoord(x + xOffset);
    //         var y = wrapCoord(y + yOffset);
    //         if (readBuffer[y * resolution + x] == next_state) {
    //             neighborCount += 1;
    //         }
    //     }
    // }
    return 0.0;
}

// Source: https://vectrx.substack.com/p/webgpu-cellular-automata
fn searchCircle(minDist: i32, maxDist: i32, idx: vec2<u32>) -> f32 {
    var aliveCount = 0u;
    var totalCount = 0u;

    let rMinSqr = minDist * minDist;
    let rMaxSqr = maxDist * maxDist;

    for (var yOffset: i32 = -maxDist; yOffset <= maxDist; yOffset += 1) {
        let y2 = yOffset * yOffset;
        for (var xOffset: i32 = -maxDist; xOffset <= maxDist; xOffset += 1) {
            let d2 = xOffset * xOffset + y2;
            if (d2 < rMinSqr || d2 > rMaxSqr) {
                // skip cells that are below the min distance
                continue;
            }

            let coord = vec2i(idx) + vec2i(xOffset, yOffset);
            let neighborIdx = vec2u((coord + BOARD) % BOARD);

            aliveCount += textureLoad(computeTextureSrc, neighborIdx).x;
            totalCount += 1;
        }
    }

    return f32(aliveCount) / f32(totalCount);
}


@compute @workgroup_size(
    WORKGROUP_SIZE,
    WORKGROUP_SIZE,
    1
) fn main(@builtin(global_invocation_id) id : vec3u) {
    let idx = id.xy;

    let old_state = textureLoad(computeTextureSrc, idx);
    var new_state = old_state.x;

    ${ neighborhoods.map(getNeighborhoodCall).join('\n') }

    textureStore(computeTextureDst, idx, vec4u(new_state, old_state.x, old_state.y, old_state.z));
}`
}

function getNeighborhoodCall(neighborhood: Neighborhood, n_idx: number) {
    const { minDist, maxDist, } = neighborhood;
    const neighborhoodFnName = neighborhood.shape === 'CIRCLE' ? 'searchCircle' : 'searchSquare';
    return `
{
    let density = ${neighborhoodFnName} ( ${minDist}, ${maxDist}, idx );
    for (var i: u32 = 0; i < ${MAX_RULE_SIZE}; i++) {
        let rule = neighborhoods[${n_idx}].rules[i];
        if (rule.x > 999) { break; }
        if (density >= rule.y && density <= rule.z) {
            new_state = select(0u, 1u, rule.x >= 0);
        }
    }
}`
}