type Neighborhood = {
    shapes: {
        type: 'CIRCLE' | 'SQUARE'; // TODO: von neumann
        minDist: number;
        maxDist: number;
    }[];
}

type Rule = {
    neighborhoodIndex: number;
    result: number;
    minDensity: number;
    maxDensity: number;
}

type ComputeShaderParams = {
    width: number;
    height: number;
    workGroupSize: number;
    neighborhoods: Neighborhood[];
    rules: Rule[];
}


export const MAX_RULE_SIZE = 8;
export const MAX_SHAPES_PER_NEIGHBORHOOD = 4;


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
    let col = select(colors.deadCol, colors.aliveCol, cellState == 1u);
    return vec4f(col.xyz, 1.0);
}`
}

export function getComputeShader(
    { width, height, workGroupSize, neighborhoods, rules }: ComputeShaderParams
) {
    return /* wgsl */`
const BOARD = vec2i(${width}, ${height});
const WORKGROUP_SIZE : u32 = ${workGroupSize}u;


struct Shape {
    distance: vec2i, // x: minDist, y: maxDist
    shapeType: u32,  // 0: square, 1: circle, 2: von neumann, 999: unused
};

struct Neighborhood {
    shapeCount: u32,
    shapes: array<Shape, ${MAX_SHAPES_PER_NEIGHBORHOOD}>,
};

struct Rule {
    // vec4f represents:
    // x: neighborhood index
    // y: positive: life; negative: death; > 999 = not defined (end of defined rules)
    // z,w: density range at which the rule applies (min, max)
    data: vec4f,
};

@group(0) @binding(0) var computeTextureSrc: texture_storage_2d<r32uint, read>;
@group(0) @binding(1) var computeTextureDst: texture_storage_2d<r32uint, read_write>;

@group(0) @binding(2) var<uniform> neighborhoods: array<Neighborhood, ${neighborhoods.length}>;
@group(0) @binding(3) var<uniform> rules: array<Rule, ${MAX_RULE_SIZE}>;


fn searchSquare(minDist: i32, maxDist: i32, idx: vec2<u32>) -> f32 {
    var neighborCount : u32 = 0u;

    for (var y: i32 = -maxDist; y <= maxDist; y+= 1) {
        for (var x: i32 = -maxDist; x <= maxDist; x+= 1) {
            // Skip cells inside the minimum distance
            if (minDist > 0 && abs(x) < minDist && abs(y) < minDist) {
                continue;
            }

            let coord = vec2i(idx) + vec2i(x, y);
            let neighborIdx = vec2u((coord + BOARD) % BOARD);

            neighborCount += textureLoad(computeTextureSrc, neighborIdx).x;
        }
    }

    let neighborhoodWidth = f32(maxDist * 2 + 1);
    let neighborhoodArea = neighborhoodWidth * neighborhoodWidth;
    
    // Calculate the area to subtract (inner square that's excluded)
    var subArea: f32 = 0.0;
    if (minDist > 0) {
        let innerWidth = f32((minDist - 1) * 2 + 1);
        subArea = innerWidth * innerWidth;
    }
    
    return f32(neighborCount) / (neighborhoodArea - subArea);
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
                // skip cells that are outside the ring
                continue;
            }

            let coord = vec2i(idx) + vec2i(xOffset, yOffset);
            let neighborIdx = vec2u((coord + BOARD) % BOARD);

            aliveCount += textureLoad(computeTextureSrc, neighborIdx).x;
            totalCount += 1;
        }
    }

    if (totalCount == 0u) {
        return 0.0;
    }
    
    return f32(aliveCount) / f32(totalCount);
}

fn searchNeumann(minDist: i32, maxDist: i32, id: vec2<u32>) -> f32 {
    // TODO von neumann with min dist
    return 0.0;
}

fn computeNeighborhoodDensity(neighborhoodIdx: u32, idx: vec2<u32>) -> f32 {
    let neighborhood = neighborhoods[neighborhoodIdx];
    var totalDensity: f32 = 0.0;
    var validShapes: u32 = 0u;

    for (var shapeIdx: u32 = 0u; shapeIdx < neighborhood.shapeCount; shapeIdx++) {
        let shape = neighborhood.shapes[shapeIdx];
        
        // Skip invalid shapes
        if (shape.shapeType > 900u) {
            continue;
        }

        var shapeDensity: f32 = 0.0;

        if (shape.shapeType == 0u) {
            shapeDensity = searchSquare(
                shape.distance.x,
                shape.distance.y,
                idx
            );
        } else if (shape.shapeType == 1u) {
            shapeDensity = searchCircle(
                shape.distance.x,
                shape.distance.y,
                idx
            );
        } else if (shape.shapeType == 2u) {
            shapeDensity = searchNeumann(
                shape.distance.x,
                shape.distance.y,
                idx
            );
        }

        totalDensity += shapeDensity;
        validShapes += 1u;
    }

    // Return average density across all shapes in the neighborhood
    if (validShapes > 0u) {
        return totalDensity / f32(validShapes);
    }
    return 0.0;
}


@compute @workgroup_size(
    WORKGROUP_SIZE,
    WORKGROUP_SIZE,
    1
) fn main(@builtin(global_invocation_id) id : vec3u) {
    let idx = id.xy;

    let old_state = textureLoad(computeTextureSrc, idx);
    var new_state = old_state.x;

    // Cache neighborhood densities to avoid recomputing
    var densityCache: array<f32, ${neighborhoods.length}>;
    var densityCached: array<bool, ${neighborhoods.length}>;
    
    for (var i: u32 = 0u; i < ${neighborhoods.length}u; i++) {
        densityCached[i] = false;
    }

    // Process rules in order
    for (var r_idx: u32 = 0u; r_idx < ${rules.length}u; r_idx++) {
        let rule = rules[r_idx];
        
        // Check if rule is defined
        if (rule.data.y > 999.0) {
            break; 
        }

        let neighborhoodIdx = u32(rule.data.x);
        
        // Get or compute density for this neighborhood
        var density: f32;
        if (!densityCached[neighborhoodIdx]) {
            density = computeNeighborhoodDensity(neighborhoodIdx, idx);
            densityCache[neighborhoodIdx] = density;
            densityCached[neighborhoodIdx] = true;
        } else {
            density = densityCache[neighborhoodIdx];
        }

        // Apply rule if density is in range
        if (density >= rule.data.z && density <= rule.data.w) {
            new_state = select(0u, 1u, rule.data.y >= 0.0);
        }
    }

    textureStore(computeTextureDst, idx, vec4u(new_state, old_state.x, old_state.y, old_state.z));
}`
}