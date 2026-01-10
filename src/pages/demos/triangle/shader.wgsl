struct Fragment {
    @builtin(position) pos: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(
    @location(0) vertexPosition: vec2<f32>,
    @location(1) vertexColor: vec3<f32>
) -> Fragment {

    var output: Fragment;

    output.pos = vec4<f32>(vertexPosition, 0.0, 1.0);
    output.color = vec4<f32>(vertexColor, 1.0);

    return output;
}

@fragment
fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4f {
    return color;
}
