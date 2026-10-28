#version 300 es
// Modes: 0 rounded rectangle (signed distance), 1 SDF text, 2 icon (RGBA atlas).
precision highp float;

in vec2 vUV;
in vec4 vColor;
in vec4 vLocal;
in vec4 vParams;
in vec4 vClip;
in vec2 vPos;

uniform sampler2D uFont;
uniform sampler2D uIcons;

out vec4 outColor;

float roundedRectDistance(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
    // clip mask applied at the end so the SDF derivatives stay well defined
    float inside = (vPos.x < vClip.x || vPos.y < vClip.y || vPos.x > vClip.z || vPos.y > vClip.w) ? 0.0 : 1.0;
    int mode = int(vParams.y + 0.5);
    float alpha = 1.0;
    vec4 color = vColor;

    if (mode == 0) {
        vec2 halfSize = vLocal.zw * 0.5;
        float radius = min(vParams.x, min(halfSize.x, halfSize.y));
        float d = roundedRectDistance(vLocal.xy - halfSize, halfSize, radius);
        float soft = max(vParams.w, 0.6);
        alpha = 1.0 - smoothstep(-soft, soft, d);
    } else if (mode == 1) {
        float dist = texture(uFont, vUV).r;
        float w = max(fwidth(dist) * 0.7, 0.002);
        float threshold = vParams.z;
        alpha = smoothstep(threshold - w, threshold + w, dist);
    } else {
        color *= texture(uIcons, vUV);
    }
    outColor = vec4(color.rgb, color.a * alpha * inside);
    if (outColor.a <= 0.002) discard;
}
