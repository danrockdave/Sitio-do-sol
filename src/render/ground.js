/**
 * Ground plane built in code (a subdivided grid). Its material uses the
 * "ground" shader mode: grass and dirt textures blended by the splat map.
 */

import { GpuModel } from '../gl/mesh.js';

export function createGroundModel(gl, size = 130, segments = 65) {
  const half = size / 2;
  const verts = [];
  const indices = [];
  for (let j = 0; j <= segments; j++) {
    for (let i = 0; i <= segments; i++) {
      const x = -half + (size * i) / segments;
      const z = -half + (size * j) / segments;
      verts.push(x, 0, z, 0, 1, 0, x, z);
    }
  }
  const row = segments + 1;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = i + j * row;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      // counter-clockwise seen from above (+Y)
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = {
    vertices: new Float32Array(verts),
    indices: new Uint32Array(indices),
    parts: [{ name: 'ground', start: 0, count: indices.length, submeshes: [{ material: 'ground', start: 0, count: indices.length }] }],
    bounds: { min: [-half, 0, -half], max: [half, 0, half] },
  };
  const materials = {
    ground: { name: 'ground', kd: [1, 1, 1], ks: [0.04, 0.04, 0.04], ke: [0, 0, 0], ns: 8, opacity: 1, texture: null, ground: true },
  };
  const model = new GpuModel(gl, 'ground', geometry, materials);
  model.wind = 0;
  model.castShadow = false;
  model.pivots = {};
  return model;
}
