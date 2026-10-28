/**
 * Helpers that build part transforms for skeleton-less animation:
 * each animated OBJ object rotates around its pivot,  M = T(p) * R * T(-p).
 */

import { mat4 } from '../../lib/gl-matrix/index.js';

const DEG = Math.PI / 180;

export function pivotRotation(pivot, rxDeg = 0, ryDeg = 0, rzDeg = 0, translate = null) {
  const m = mat4.create();
  if (translate) mat4.translate(m, m, translate);
  mat4.translate(m, m, pivot);
  if (ryDeg) mat4.rotateY(m, m, ryDeg * DEG);
  if (rxDeg) mat4.rotateX(m, m, rxDeg * DEG);
  if (rzDeg) mat4.rotateZ(m, m, rzDeg * DEG);
  mat4.translate(m, m, [-pivot[0], -pivot[1], -pivot[2]]);
  return m;
}

/** World matrix: translation, yaw (radians), optional tilt and uniform/non-uniform scale. */
export function placement(x, y, z, yaw, { scale = 1, tiltX = 0, tiltZ = 0 } = {}) {
  const m = mat4.create();
  mat4.translate(m, m, [x, y, z]);
  mat4.rotateY(m, m, yaw);
  if (tiltX) mat4.rotateX(m, m, tiltX);
  if (tiltZ) mat4.rotateZ(m, m, tiltZ);
  if (scale !== 1) mat4.scale(m, m, Array.isArray(scale) ? scale : [scale, scale, scale]);
  return m;
}

export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
