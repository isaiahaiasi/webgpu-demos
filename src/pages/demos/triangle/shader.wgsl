struct TransformData {
    model: mat4x4<f32>,
    view: mat4x4<f32>,
    projection: mat4x4<f32>,
};
@binding(0) @group(0) var<uniform> transformUBO: TransformData;

struct Fragment {
    @builtin(position) pos: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(
    @location(0) vertexPosition: vec3<f32>,
    @location(1) vertexColor: vec3<f32>
) -> Fragment {

    var output: Fragment;

    output.pos = transformUBO.projection
        * transformUBO.view
        * transformUBO.model
        * vec4<f32>(vertexPosition, 1.0);

    output.color = vec4<f32>(vertexColor, 1.0);

    return output;
}

@fragment
fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4f {
    return color;
}
