/**
 * GPU-side model: one VAO with an interleaved vertex buffer
 * (position, normal, uv) and a 32-bit index buffer.
 *
 * Per-instance data (model matrix + tint colour) lives in a separate
 * buffer bound at draw time, which lets the renderer draw many copies of
 * the same part with a single drawElementsInstanced call.
 *
 * Attribute locations (shared by every 3D shader):
 *   0 aPosition  1 aNormal  2 aUV  3..6 aModel (mat4 columns)  7 aTint
 */

export const INSTANCE_FLOATS = 20;
export const INSTANCE_BYTES = INSTANCE_FLOATS * 4;
const VERTEX_BYTES = 8 * 4;

export class GpuModel {
  constructor(gl, name, geometry, materials) {
    this.gl = gl;
    this.name = name;
    this.parts = geometry.parts;
    this.bounds = geometry.bounds;
    this.materials = materials;
    this.triangleCount = geometry.indices.length / 3;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VERTEX_BYTES, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, VERTEX_BYTES, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, VERTEX_BYTES, 24);

    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    this.partByName = {};
    for (const part of this.parts) this.partByName[part.name] = part;
    // Bounding sphere (model space) used for icon framing and picking.
    const { min, max } = this.bounds;
    this.center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    this.radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  }
}

/** Points instance attributes 3..7 of the currently bound VAO at `byteOffset` in `buffer`. */
export function bindInstanceAttributes(gl, buffer, byteOffset) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (let i = 0; i < 4; i++) {
    const loc = 3 + i;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, INSTANCE_BYTES, byteOffset + i * 16);
    gl.vertexAttribDivisor(loc, 1);
  }
  gl.enableVertexAttribArray(7);
  gl.vertexAttribPointer(7, 4, gl.FLOAT, false, INSTANCE_BYTES, byteOffset + 64);
  gl.vertexAttribDivisor(7, 1);
}
