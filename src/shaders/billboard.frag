#version 300 es
precision highp float;

in vec2 vUV;
in vec2 vLocal;
in vec4 vColor;
flat in int vMode;

uniform sampler2D uIcons;

out vec4 outColor;

void main() {
    float r = length(vLocal);
    vec4 color = vColor;
    if (vMode == 0) {
        color.a *= smoothstep(0.5, 0.05, r);          // soft glowing dot
    } else if (vMode == 1) {
        color *= texture(uIcons, vUV);                // icon from the atlas
    } else {
        color.a *= smoothstep(0.5, 0.46, r);          // crisp disc (bubble background)
    }
    if (color.a < 0.01) discard;
    outColor = color;
}
