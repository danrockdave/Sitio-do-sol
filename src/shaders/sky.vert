#version 300 es
// Full-screen triangle generated from gl_VertexID (no vertex buffer needed).
out vec2 vNdc;

void main() {
    vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
    vNdc = pos;
    gl_Position = vec4(pos, 1.0, 1.0);
}
