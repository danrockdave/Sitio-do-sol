#version 300 es
// Procedural sky: vertical gradient, sun and moon discs, stars and drifting clouds.
precision highp float;

in vec2 vNdc;

uniform mat4 uInvViewProj;
uniform vec3 uCameraPos;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uSunVisible;
uniform float uMoonVisible;
uniform float uStars;
uniform float uTime;
uniform vec3 uCloudColor;

out vec4 outColor;

float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(vec3(i, 1.0));
    float b = hash(vec3(i + vec2(1.0, 0.0), 1.0));
    float c = hash(vec3(i + vec2(0.0, 1.0), 1.0));
    float d = hash(vec3(i + vec2(1.0, 1.0), 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += noise2(p) * a;
        p *= 2.03;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec4 farPoint = uInvViewProj * vec4(vNdc, 1.0, 1.0);
    vec3 dir = normalize(farPoint.xyz / farPoint.w - uCameraPos);
    float h = dir.y;

    vec3 color = mix(uSkyHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.55));
    if (h < 0.0) color = mix(uSkyHorizon, uSkyHorizon * 0.85, clamp(-h * 3.0, 0.0, 1.0));

    // stars (hashed cells on the sky sphere)
    if (uStars > 0.0 && h > 0.0) {
        vec3 cell = floor(dir * 220.0);
        float n = hash(cell);
        float twinkle = 0.65 + 0.35 * sin(uTime * 2.3 + n * 91.0);
        float star = step(0.9972, n) * twinkle;
        color += vec3(star) * uStars * clamp(h * 5.0, 0.0, 1.0);
    }

    // sun disc and glow
    float sd = max(dot(dir, normalize(uSunDir)), 0.0);
    color += uSunColor * (smoothstep(0.99955, 0.9997, sd) * 2.2 + pow(sd, 10.0) * 0.28) * uSunVisible;

    // moon disc and halo
    float md = max(dot(dir, normalize(uMoonDir)), 0.0);
    color += vec3(0.92, 0.95, 1.0) * smoothstep(0.99955, 0.9997, md) * uMoonVisible;
    color += vec3(0.25, 0.32, 0.55) * pow(md, 40.0) * 0.35 * uMoonVisible;

    // clouds on a virtual plane above the camera
    if (h > 0.02) {
        vec2 uv = dir.xz / h * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
        float c = smoothstep(0.52, 0.78, fbm(uv));
        float fade = smoothstep(0.02, 0.25, h);
        color = mix(color, uCloudColor, c * 0.75 * fade);
    }

    outColor = vec4(color, 1.0);
}
