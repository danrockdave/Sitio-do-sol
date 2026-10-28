#version 300 es
// Phong reflection model:  I = Ia*ka + sum_lights( Id*kd*(N.L) + Is*ks*(R.V)^n )
// with R = reflect(-L, N)  (classic Phong, not Blinn-Phong).
//
// Lights: one directional light (sun by day, moon by night) with a shadow
// map, up to 8 point lights (lanterns, the farmer's lamp) and a hemispheric
// ambient term. Emissive colour (Ke) lights windows and lanterns at night.

precision highp float;
precision highp sampler2DShadow;

in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUV;
in vec4 vTint;
in vec4 vShadowCoord;

uniform vec3 uCameraPos;

// material
uniform vec3 uKd;
uniform vec3 uKs;
uniform vec3 uKe;
uniform float uNs;
uniform bool uHasMap;
uniform sampler2D uMap;

// 0 = lit model, 1 = ground (grass/dirt blended by a splat map), 2 = unlit overlay
uniform int uMode;
uniform sampler2D uGrassMap;
uniform sampler2D uDirtMap;
uniform sampler2D uSplatMap;
uniform vec4 uSplatRect;      // xMin, zMin, width, depth (world units)
uniform float uGroundTiling;

// lights
uniform vec3 uLightDir;       // unit vector pointing TO the light
uniform vec3 uLightColor;
uniform vec3 uAmbientSky;
uniform vec3 uAmbientGround;
#define MAX_POINT_LIGHTS 8
uniform int uPointCount;
uniform vec3 uPointPos[MAX_POINT_LIGHTS];
uniform vec3 uPointColor[MAX_POINT_LIGHTS];
uniform float uPointRange[MAX_POINT_LIGHTS];

uniform sampler2DShadow uShadowMap;
uniform bool uShadowsEnabled;
uniform float uShadowStrength;
uniform float uShadowTexel;
uniform int uPcfRadius;       // 1 = 3x3 filtering, 0 = single hardware-filtered tap

uniform float uGlow;          // emissive multiplier (1 at night, ~0 at noon)
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform int uDebugView;       // 0 full, 1 ambient, 2 diffuse, 3 specular, 4 normals, 5 shadow, 6 albedo

out vec4 outColor;

float sampleShadow(vec3 n) {
    if (!uShadowsEnabled) return 1.0;
    vec3 c = vShadowCoord.xyz / vShadowCoord.w;
    if (c.x <= 0.0 || c.x >= 1.0 || c.y <= 0.0 || c.y >= 1.0 || c.z >= 1.0) return 1.0;
    float slope = 1.0 - clamp(dot(n, uLightDir), 0.0, 1.0);
    float bias = 0.0008 + 0.0025 * slope;
    // (2r+1)^2 PCF on top of the hardware 2x2 comparison filtering
    float sum = 0.0;
    float taps = 0.0;
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            if (abs(x) > uPcfRadius || abs(y) > uPcfRadius) continue;
            sum += texture(uShadowMap, vec3(c.xy + vec2(float(x), float(y)) * uShadowTexel, c.z - bias));
            taps += 1.0;
        }
    }
    return sum / taps;
}

void main() {
    vec3 albedo;
    float alpha = vTint.a;

    if (uMode == 1) {
        vec2 tuv = vWorldPos.xz * uGroundTiling;
        vec2 suv = (vWorldPos.xz - uSplatRect.xy) / uSplatRect.zw;
        float dirtAmount = texture(uSplatMap, suv).r;
        vec3 grass = texture(uGrassMap, tuv).rgb;
        float patches = texture(uGrassMap, tuv * 0.063 + 0.37).g;     // low-frequency variation
        grass *= 0.86 + 0.28 * patches;
        vec3 dirt = texture(uDirtMap, tuv * 0.85).rgb;
        albedo = mix(grass, dirt, smoothstep(0.15, 0.85, dirtAmount)) * uKd;
    } else {
        albedo = uKd * vTint.rgb;
        if (uHasMap) {
            vec4 texel = texture(uMap, vUV);
            albedo *= texel.rgb;
            alpha *= texel.a;
        }
    }

    if (uMode == 2) {
        outColor = vec4(albedo + uKe, alpha);
        return;
    }

    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 L = normalize(uLightDir);

    // ambient (hemisphere: sky colour from above, ground bounce from below)
    vec3 ambient = mix(uAmbientGround, uAmbientSky, N.y * 0.5 + 0.5) * albedo;

    // directional light (sun / moon)
    float shadow = mix(1.0, sampleShadow(N), uShadowStrength);
    float NdotL = max(dot(N, L), 0.0);
    vec3 R = reflect(-L, N);
    float specTerm = NdotL > 0.0 ? pow(max(dot(R, V), 0.0), uNs) : 0.0;
    vec3 diffuse = albedo * uLightColor * NdotL * shadow;
    vec3 specular = uKs * uLightColor * specTerm * shadow;

    // point lights
    for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
        if (i >= uPointCount) break;
        vec3 toLight = uPointPos[i] - vWorldPos;
        float dist = length(toLight);
        float att = clamp(1.0 - dist / uPointRange[i], 0.0, 1.0);
        att *= att;
        vec3 Lp = toLight / max(dist, 1e-4);
        float nl = max(dot(N, Lp), 0.0);
        vec3 Rp = reflect(-Lp, N);
        float sp = nl > 0.0 ? pow(max(dot(Rp, V), 0.0), uNs) : 0.0;
        diffuse += albedo * uPointColor[i] * nl * att;
        specular += uKs * uPointColor[i] * sp * att;
    }

    vec3 emissive = uKe * uGlow;
    vec3 color = ambient + diffuse + specular + emissive;

    if (uDebugView == 1) color = ambient;
    else if (uDebugView == 2) color = diffuse;
    else if (uDebugView == 3) color = specular;
    else if (uDebugView == 4) color = N * 0.5 + 0.5;
    else if (uDebugView == 5) color = vec3(shadow);
    else if (uDebugView == 6) color = albedo;

    if (uDebugView == 0) {
        float dist = length(uCameraPos - vWorldPos);
        float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
        color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));
    }
    outColor = vec4(color, alpha);
}
