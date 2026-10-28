#version 300 es
// Main 3D vertex shader: instanced model matrix, wind sway, shadow coordinates.

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aModel0;
layout(location = 4) in vec4 aModel1;
layout(location = 5) in vec4 aModel2;
layout(location = 6) in vec4 aModel3;
layout(location = 7) in vec4 aTint;

uniform mat4 uViewProj;
uniform mat4 uShadowMatrix;   // world -> shadow map texture space [0,1]
uniform float uTime;
uniform float uWind;          // sway strength for plants (0 = static)
uniform float uWave;          // wave height for water surfaces (0 = flat)

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;
out vec4 vTint;
out vec4 vShadowCoord;

vec3 applyWind(vec3 p, vec3 origin) {
    if (uWind <= 0.0) return p;
    float h = max(p.y, 0.0);
    float phase = uTime * 1.8 + origin.x * 0.73 + origin.z * 0.41;
    float gust = 0.6 + 0.4 * sin(uTime * 0.35 + origin.x * 0.05);
    p.x += sin(phase) * uWind * gust * h * h;
    p.z += cos(phase * 0.83) * uWind * 0.6 * gust * h * h;
    return p;
}

void main() {
    mat4 model = mat4(aModel0, aModel1, aModel2, aModel3);
    vec3 localPos = applyWind(aPosition, model[3].xyz);
    vec4 world = model * vec4(localPos, 1.0);

    // Normal matrix = inverse transpose of the upper 3x3 (handles non-uniform scale).
    mat3 normalMatrix = transpose(inverse(mat3(model)));
    vNormal = normalize(normalMatrix * aNormal);

    // Water: sum of three sine waves; the normal comes from the analytic derivatives.
    if (uWave > 0.0) {
        float k1 = world.x * 1.7 + uTime * 1.3;
        float k2 = world.z * 2.1 + uTime * 1.1;
        float k3 = (world.x + world.z) * 1.3 - uTime * 1.7;
        world.y += (sin(k1) + cos(k2) + 0.6 * sin(k3)) * uWave;
        float dx = (1.7 * cos(k1) + 0.78 * cos(k3)) * uWave;
        float dz = (-2.1 * sin(k2) + 0.78 * cos(k3)) * uWave;
        vNormal = normalize(vec3(-dx, 1.0, -dz));
    }
    vWorldPos = world.xyz;
    vUV = aUV;
    vTint = aTint;
    vShadowCoord = uShadowMatrix * world;
    gl_Position = uViewProj * world;
}
