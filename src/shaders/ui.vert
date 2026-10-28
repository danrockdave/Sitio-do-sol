#version 300 es
// 2D interface quads in pixel coordinates (origin at the top-left corner).

layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUV;
layout(location = 2) in vec4 aColor;
layout(location = 3) in vec4 aLocal;    // local x, y inside the rect, rect width, height
layout(location = 4) in vec4 aParams;   // corner radius, mode, SDF threshold, edge softness
layout(location = 5) in vec4 aClip;     // clip rectangle x0, y0, x1, y1 (scrollable lists)

uniform vec2 uResolution;

out vec2 vUV;
out vec4 vColor;
out vec4 vLocal;
out vec4 vParams;
out vec4 vClip;
out vec2 vPos;

void main() {
    vUV = aUV;
    vColor = aColor;
    vLocal = aLocal;
    vParams = aParams;
    vClip = aClip;
    vPos = aPos;
    vec2 ndc = vec2(aPos.x / uResolution.x * 2.0 - 1.0, 1.0 - aPos.y / uResolution.y * 2.0);
    gl_Position = vec4(ndc, 0.0, 1.0);
}
