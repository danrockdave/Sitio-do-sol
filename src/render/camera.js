/**
 * Third-person camera with perspective projection.
 *
 * The camera orbits a target point (the farmer) defined by yaw, pitch and
 * distance. Mouse drag / Z-C keys change the yaw, the wheel changes the
 * distance, and the target follows the player with exponential smoothing.
 */

import { mat4, vec3, vec4 } from '../../lib/gl-matrix/index.js';

export class FollowCamera {
  constructor() {
    this.target = vec3.fromValues(0, 0, 0);
    this.yaw = 0;                 // 0 = camera south of the target, looking north (-Z)
    this.pitch = 0.92;            // radians above the horizon
    this.distance = 14;
    this.minDistance = 6;
    this.maxDistance = 30;
    this.fov = (40 * Math.PI) / 180;
    this.near = 0.3;
    this.far = 220;

    this.eye = vec3.create();
    this.view = mat4.create();
    this.projection = mat4.create();
    this.viewProj = mat4.create();
    this.invViewProj = mat4.create();
    this.right = vec3.create();
    this.up = vec3.create();
    this.aspect = 1;
  }

  follow(position, dt, sharpness = 6) {
    const t = 1 - Math.exp(-dt * sharpness);
    vec3.lerp(this.target, this.target, position, t);
  }

  zoom(delta) {
    this.distance = Math.min(this.maxDistance, Math.max(this.minDistance, this.distance * Math.exp(delta)));
  }

  /** Horizontal forward / right vectors for camera-relative movement. */
  groundAxes() {
    return {
      forward: [-Math.sin(this.yaw), 0, -Math.cos(this.yaw)],
      right: [Math.cos(this.yaw), 0, -Math.sin(this.yaw)],
    };
  }

  update(aspect) {
    this.aspect = aspect;
    const cp = Math.cos(this.pitch);
    this.eye[0] = this.target[0] + Math.sin(this.yaw) * cp * this.distance;
    this.eye[1] = this.target[1] + Math.sin(this.pitch) * this.distance;
    this.eye[2] = this.target[2] + Math.cos(this.yaw) * cp * this.distance;
    mat4.lookAt(this.view, this.eye, this.target, [0, 1, 0]);
    mat4.perspective(this.projection, this.fov, aspect, this.near, this.far);
    mat4.multiply(this.viewProj, this.projection, this.view);
    mat4.invert(this.invViewProj, this.viewProj);
    // camera basis from the view matrix rows (used by billboards)
    vec3.set(this.right, this.view[0], this.view[4], this.view[8]);
    vec3.set(this.up, this.view[1], this.view[5], this.view[9]);
  }

  /** World-space ray through a point given in normalized device coordinates. */
  rayFromNdc(nx, ny) {
    const near = vec4.transformMat4(vec4.create(), [nx, ny, -1, 1], this.invViewProj);
    const far = vec4.transformMat4(vec4.create(), [nx, ny, 1, 1], this.invViewProj);
    const origin = [near[0] / near[3], near[1] / near[3], near[2] / near[3]];
    const end = [far[0] / far[3], far[1] / far[3], far[2] / far[3]];
    const dir = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), end, origin));
    return { origin, dir };
  }

  /** Projects a world point to normalized device coordinates; returns null when behind the camera. */
  project(point) {
    const p = vec4.transformMat4(vec4.create(), [point[0], point[1], point[2], 1], this.viewProj);
    if (p[3] <= 0) return null;
    return [p[0] / p[3], p[1] / p[3], p[2] / p[3]];
  }
}
