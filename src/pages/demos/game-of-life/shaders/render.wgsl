/*
Consts prepended in JavaScript module:
- BOARD : vec2f
- SCALE : vec2f
*/

struct VSOut {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f
};

struct Colors {
    aliveCol: vec4f, // .w unused, but uniform padding requires 4 bytes
    deadCol: vec4f,
}


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
    let scaled = SCALE * v;
    out.pos = vec4f(scaled, 0.0, 1.0);

    // Map scaled clip space back to [0, 1] for sampling
    // scaled is in [-SCALE_X, SCALE_X] × [-SCALE_Y, SCALE_Y]
    // center it and clamp to board area
    let centered = (scaled + SCALE) / (SCALE * 2.0);
    out.uv = centered;
    out.uv.y = 1.0 - out.uv.y;
    return out;
}


@fragment
fn fs(@location(0) uv : vec2f) -> @location(0) vec4f {
    let x = u32(floor(uv.x * f32(BOARD.x)));
    let y = u32(floor(uv.y * f32(BOARD.y)));
    let cellState = textureLoad(renderTexture, vec2u(x, y)).x;
    if (cellState == 1u) {
        return vec4f(colors.aliveCol.xyz, 1.0);
    }
    return vec4f(colors.deadCol.xyz, 1.0);
}