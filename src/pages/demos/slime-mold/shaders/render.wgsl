// Consts prepended in JavaScript:
// SCALE_X : f32
// SCALE_Y : f32

struct VOut {
    @builtin(position) position: vec4f,
    @location(0) fragUV: vec2f,
};

@group(0) @binding(0) var texSampler : sampler;
@group(0) @binding(1) var bgTex : texture_2d<f32>;
@group(0) @binding(2) var agentTex : texture_2d<f32>;
@group(0) @binding(3) var<uniform> bgCol: vec4f;

// simple texture rendering based on:
// https://webgpu.github.io/webgpu-samples/samples/imageBlur
@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VOut {
    // This is a little sketchy, but if everything is being done in shaders,
    // there's no need to complicate the pipeline with vector buffers etc.
    const pos = array(
        vec2( 1.0,  1.0),
        vec2( 1.0, -1.0),
        vec2(-1.0, -1.0),
        vec2( 1.0,  1.0),
        vec2(-1.0, -1.0),
        vec2(-1.0,  1.0),
    );

    var output: VOut;
    let scaledPos = pos[vi] * vec2f(SCALE_X, SCALE_Y);
    output.position = vec4(scaledPos, 0.0, 1.0);
    
    // Map scaled clip space back to [0, 1] for sampling
    let centered = 
        (scaledPos + vec2f(SCALE_X, SCALE_Y))
        / vec2f(2.0 * SCALE_X, 2.0 * SCALE_Y);

    output.fragUV = centered;
    output.fragUV.y = 1.0 - output.fragUV.y;

    return output;
}

@fragment
fn fs(@location(0) fragUV: vec2f) -> @location(0) vec4f {
    let agentSample = textureSample(agentTex, texSampler, fragUV);
    var bgSample = textureSample(bgTex, texSampler, fragUV);
    return agentSample + bgSample + bgCol;
}
