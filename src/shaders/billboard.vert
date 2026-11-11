#version 300 es
// Camera-facing quads (particles, fireflies, "ready" bubbles over animals).

layout(location = 0) in vec2 aCorner;       // quad corner in [-0.5, 0.5]
layout(location = 1) in vec4 aCenterSize;   // xyz = world centre, w = size
layout(location = 2) in vec4 aUVRect;       // u0, vTop, u1, vBottom (icon atlas)
layout(location = 3) in vec4 aColor;
layout(location = 4) in float aMode;        // 0 soft dot, 1 icon, 2 solid disc, 3 rain streak

uniform mat4 uViewProj;
uniform vec3 uCamRight;
uniform vec3 uCamUp;

out vec2 vUV;
out vec2 vLocal;
out vec4 vColor;
flat out int vMode;

void main() {
    vec3 world;
    if (aMode > 2.5) {
        // rain streak: thin quad stretched along the falling direction (world up, a bit slanted)
        vec3 fall = normalize(vec3(0.12, 1.0, 0.05));
        world = aCenterSize.xyz + uCamRight * aCorner.x * aCenterSize.w * 0.035 + fall * aCorner.y * aCenterSize.w;
    } else {
        world = aCenterSize.xyz + (uCamRight * aCorner.x + uCamUp * aCorner.y) * aCenterSize.w;
    }
    vUV = vec2(mix(aUVRect.x, aUVRect.z, aCorner.x + 0.5), mix(aUVRect.w, aUVRect.y, aCorner.y + 0.5));
    vLocal = aCorner;
    vColor = aColor;
    vMode = int(aMode + 0.5);
    gl_Position = uViewProj * vec4(world, 1.0);
}
