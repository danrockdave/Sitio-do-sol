#version 300 es
// Depth-only pass rendered from the light's point of view (shadow map).

layout(location = 0) in vec3 aPosition;
layout(location = 3) in vec4 aModel0;
layout(location = 4) in vec4 aModel1;
layout(location = 5) in vec4 aModel2;
layout(location = 6) in vec4 aModel3;

uniform mat4 uLightViewProj;
uniform float uTime;
uniform float uWind;

void main() {
    mat4 model = mat4(aModel0, aModel1, aModel2, aModel3);
    vec3 p = aPosition;
    if (uWind > 0.0) {
        vec3 origin = model[3].xyz;
        float h = max(p.y, 0.0);
        float phase = uTime * 1.8 + origin.x * 0.73 + origin.z * 0.41;
        float gust = 0.6 + 0.4 * sin(uTime * 0.35 + origin.x * 0.05);
        p.x += sin(phase) * uWind * gust * h * h;
        p.z += cos(phase * 0.83) * uWind * 0.6 * gust * h * h;
    }
    gl_Position = uLightViewProj * model * vec4(p, 1.0);
}
