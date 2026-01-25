// Javascript-prepended consts:
// i_TEX_DIMENSIONS : vec2i
// f_TEX_DIMENSIONS : vec2f

const PI = 3.14159265359;

struct SceneInfo {
    time: f32,
    deltaTime: f32,
};

// ALPHABETICALLY ORDERED
struct SimOptions {
    diffuseSpeed: f32,
    evaporateSpeed: f32,
    evaporateWeight: vec4f,
    moveSpeed: f32,
    agentCount: u32,
    sensorAngle: f32,
    sensorDst: f32,
    turnSpeed: f32,
};

struct Agent {
    pos: vec2f,
    angle: f32,
};

// Hash function www.cs.ubc.ca/~rbridson/docs/schechter-sca08-turbulence.pdf
fn hash(s: u32) -> u32 {
    var state = s;
    state ^= 2747636419u;
    state *= 2654435769u;
    state ^= state >> 16;
    state *= 2654435769u;
    state ^= state >> 16;
    state *= 2654435769u;
    return state;
}

fn normHash(s: u32) -> f32 {
    return f32(s) / 4294967295.0;
}


@group(0) @binding(0) var<uniform> info: SceneInfo;
@group(0) @binding(1) var<uniform> options: SimOptions;
@group(0) @binding(2) var<storage, read_write> debug: array<f32, 6>;

@group(1) @binding(0) var<storage, read_write> agents: array<Agent>;
@group(1) @binding(1) var writeTex: texture_storage_2d<rgba8unorm, write>;
@group(1) @binding(2) var readTex: texture_2d<f32>;

// add up trail texels within bounds of agent sensor
// instead of looking at all, just sample a portion.
fn sense(agent: Agent, sensorAngleOffset: f32) -> f32 {
    let sensorAngle = agent.angle + sensorAngleOffset;
    let sensorDir = vec2f(cos(sensorAngle), sin(sensorAngle));
    let sensorCenter = agent.pos + sensorDir * options.sensorDst;
    
    // Just sample center + 4 cardinal directions instead of full square
    let coords = array<vec2i, 5>(
        vec2i(sensorCenter),
        vec2i(sensorCenter) + vec2i(1, 0),
        vec2i(sensorCenter) + vec2i(-1, 0),
        vec2i(sensorCenter) + vec2i(0, 1),
        vec2i(sensorCenter) + vec2i(0, -1),
    );
    
    var sum = 0.0;
    var v0 = vec2i(0);
    var v1 = vec2i(1);
    for (var i = 0; i < 5; i++) {
        let pos = clamp(
            coords[i],
            v0,
            i_TEX_DIMENSIONS - v1
        );

        let t = textureLoad(readTex, pos, 0);
        sum += t.r + t.g + t.b;
    }
    
    return sum;
}

@compute @workgroup_size(64) fn update_agents(
    @builtin(global_invocation_id) giid: vec3<u32>,
) {
    let _id = giid.x;  // Now giid.x is the flat agent index
    
    if (_id >= options.agentCount) {
        return;
    }
    
    var agent = agents[_id];
    let prn = normHash(hash(
        u32(agent.pos.y * f_TEX_DIMENSIONS.x + agent.pos.x) + hash(_id)
    ));

    // pick a direction (w some random variance)
    // based on trail density at 3 possible points in front of agent.
    let weightFwd = sense(agent, 0);
    let weightLeft = sense(agent, options.sensorAngle);
    let weightRight = sense(agent, -options.sensorAngle);

    var angle = 0.0;
    // continue in same dir
    if (weightFwd > weightLeft && weightFwd > weightRight) {
        angle = 0;
    }
    // turn randomly
    else if (weightFwd < weightLeft && weightFwd < weightRight) {
        angle = (prn - 0.5) * 2 * options.turnSpeed * info.deltaTime;
    }
    // turn left
    else if (weightLeft > weightRight) {
        angle = prn * options.turnSpeed * info.deltaTime;
    }
    // turn right
    else if (weightRight > weightLeft) {
        angle = -prn * options.turnSpeed * info.deltaTime;
    }

    agents[_id].angle = (agents[_id].angle + angle) % (2 * PI);

    // move agent based on direction and speed
    let dir = vec2f(cos(agents[_id].angle), sin(agents[_id].angle));
    var newPos = agent.pos + dir * options.moveSpeed * info.deltaTime;

    // pick a new, random angle if hit a boundary
    if (newPos.x < 0 || newPos.x >= f_TEX_DIMENSIONS.x)
            || newPos.y < 0 || newPos.y >= f_TEX_DIMENSIONS.y {
        newPos.x = clamp(newPos.x, 0, f_TEX_DIMENSIONS.x);
        newPos.y = clamp(newPos.y, 0, f_TEX_DIMENSIONS.y);
        // I shouldn't have to add & modulo, but if I just assign directly
        // to prn*2*PI, they get stuck! Not sure why.
        agents[_id].angle += (prn * 2 * PI) % (2 * PI);
    }

    agents[_id].pos = newPos;
    textureStore(writeTex, vec2u(newPos), vec4f(1));
}

@compute @workgroup_size(16, 16) fn process_trailmap(
    @builtin(global_invocation_id) giid: vec3<u32>,
) {
    if ((giid.x + giid.y + u32(info.time * 60.0)) % 2u == 0u) {
        return;
    }

    if (giid.x < 0 || giid.x >= u32(i_TEX_DIMENSIONS.x) || giid.y < 0 || giid.y >= u32(i_TEX_DIMENSIONS.y)) {
        return;
    }

    let inputValue = textureLoad(
        readTex,
        giid.xy,
        0
    );

    // Diffuse (blur) the trail by averaging the 3x3 block around current pixel
    var sum = vec4f(0);
    for (var xoff = -1; xoff <= 1; xoff++) {
        for (var yoff = -1; yoff <= 1; yoff++) {
            let xsample = i32(giid.x) + xoff;
            let ysample = i32(giid.y) + yoff;

            if (xsample >= 0 && xsample < i_TEX_DIMENSIONS.x
                    && ysample >= 0 && ysample < i_TEX_DIMENSIONS.y) 
            {
                sum += textureLoad(
                    readTex,
                    vec2i(xsample, ysample),
                    0
                );
            }
        }
    }

    let blurResult = sum / 9;
    let diffusedValue = mix(
        inputValue,
        blurResult,
        min(.999, options.diffuseSpeed * info.deltaTime)
    );

    // Make the diffused trail also "evaporate" (fade out) over time
    let evaporatedValue = max(
        vec4f(0),
        diffusedValue - options.evaporateWeight * options.evaporateSpeed * info.deltaTime,
    );

    textureStore(
        writeTex,
        giid.xy,
        evaporatedValue
    );
}
