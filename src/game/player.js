/**
 * The farmer: camera-relative movement with collisions, walk cycle and
 * tool animations built from part rotations (legs, arms, head).
 */

import { mat4 } from '../../lib/gl-matrix/index.js';
import { pivotRotation, placement, angleLerp } from './animate.js';

const WALK_SPEED = 3.4;
const RUN_SPEED = 5.4;

// how each tool sits in the right hand (local to the hand, farmer model space)
const HELD_TOOLS = {
  hoe: { model: 'hoe', translate: [0, -0.08, 0.06], rotate: [-95, 0, 55], scale: 0.9 },
  watering_can: { model: 'watering_can', translate: [0, -0.2, 0.08], rotate: [0, 90, 0], scale: 0.62 },
  basket: { model: 'basket', translate: [0, -0.22, 0.04], rotate: [0, 0, 0], scale: 0.55 },
  seed: { model: 'seed_bag', translate: [0, -0.12, 0.08], rotate: [0, 0, 0], scale: 0.45 },
};

const ACTION_DURATION = { till: 0.45, clear: 0.45, water: 0.7, plant: 0.4, harvest: 0.4, collect: 0.4, pet: 0.5 };

export class Player {
  constructor() {
    this.pos = [-9.4, 0, -8.2];
    this.yaw = 0;
    this.radius = 0.3;
    this.phase = 0;
    this.moving = 0;          // 0..1 blend between idle and walk
    this.running = false;
    this.action = null;       // { type, t, duration }
  }

  startAction(type, targetX, targetZ) {
    if (targetX !== undefined) {
      const dx = targetX - this.pos[0];
      const dz = targetZ - this.pos[2];
      if (Math.hypot(dx, dz) > 0.05) this.yaw = Math.atan2(dx, dz);
    }
    this.action = { type, t: 0, duration: ACTION_DURATION[type] || 0.4 };
  }

  get busy() {
    return this.action !== null && this.action.t < this.action.duration * 0.6;
  }

  /** move: world-space [x, z] direction (not normalized), already camera-relative. */
  update(dt, move, running, world, extraColliders) {
    const len = Math.hypot(move[0], move[1]);
    const wantsMove = len > 0.01 && !this.busy;
    if (wantsMove) {
      const dirX = move[0] / len;
      const dirZ = move[1] / len;
      const speed = running ? RUN_SPEED : WALK_SPEED;
      this.pos[0] += dirX * speed * dt;
      this.pos[2] += dirZ * speed * dt;
      this.yaw = angleLerp(this.yaw, Math.atan2(dirX, dirZ), 1 - Math.exp(-dt * 14));
      this.phase += dt * speed * 2.6;
    }
    this.running = running;
    this.moving += ((wantsMove ? 1 : 0) - this.moving) * (1 - Math.exp(-dt * 10));
    world.resolveCircle(this.pos, this.radius, extraColliders);

    if (this.action) {
      this.action.t += dt;
      if (this.action.t >= this.action.duration) this.action = null;
    }
  }

  forward() {
    return [Math.sin(this.yaw), Math.cos(this.yaw)];
  }

  /** Returns { matrix, pose, armR } where armR is the right arm local transform. */
  pose(time, pivots) {
    const w = this.moving;
    const swing = Math.sin(this.phase) * w;
    const amp = this.running ? 42 : 32;
    const pose = {};
    let armR = swing * amp;
    let armL = -swing * amp;
    let bodyTilt = 0;
    let head = Math.sin(time * 1.3) * 2 * (1 - w);

    if (this.action) {
      const t = Math.min(1, this.action.t / this.action.duration);
      const curve = Math.sin(t * Math.PI);
      switch (this.action.type) {
        case 'till':
        case 'clear':
          // raise the hoe above the head, then strike the ground
          armR = t < 0.45 ? -170 * (t / 0.45) : -170 + 230 * Math.min(1, (t - 0.45) / 0.3);
          armL = armR * 0.6;
          bodyTilt = t > 0.45 ? 0.18 * curve : -0.05 * curve;
          break;
        case 'water':
          armR = -75 + Math.sin(t * Math.PI * 4) * 8;
          bodyTilt = 0.12 * curve;
          head = 14 * curve;
          break;
        default:
          // reach forward and down (plant / harvest / collect / pet)
          armR = -70 * curve;
          armL = -40 * curve;
          bodyTilt = 0.22 * curve;
          head = 20 * curve;
          break;
      }
    }

    if (pivots.leg_l) pose.leg_l = pivotRotation(pivots.leg_l, -swing * amp);
    if (pivots.leg_r) pose.leg_r = pivotRotation(pivots.leg_r, swing * amp);
    if (pivots.arm_l) pose.arm_l = pivotRotation(pivots.arm_l, armL, 0, -4 - 3 * Math.sin(time * 1.6) * (1 - w));
    if (pivots.arm_r) pose.arm_r = pivotRotation(pivots.arm_r, armR, 0, 4 + 3 * Math.sin(time * 1.6) * (1 - w));
    if (pivots.head) pose.head = pivotRotation(pivots.head, head);

    const bob = Math.abs(Math.cos(this.phase)) * 0.045 * w;
    const matrix = placement(this.pos[0], bob, this.pos[2], this.yaw, { tiltX: bodyTilt });
    return { matrix, pose, armR: pose.arm_r || mat4.create() };
  }

  /** World matrix for the tool held in the right hand. */
  heldToolMatrix(posed, pivots, kind) {
    const spec = HELD_TOOLS[kind];
    if (!spec || !pivots.arm_r) return null;
    const m = mat4.create();
    mat4.multiply(m, posed.matrix, posed.armR);
    mat4.translate(m, m, [pivots.arm_r[0], 0.6, 0]);
    mat4.translate(m, m, spec.translate);
    const [rx, ry, rz] = spec.rotate.map((d) => (d * Math.PI) / 180);
    if (ry) mat4.rotateY(m, m, ry);
    if (rx) mat4.rotateX(m, m, rx);
    if (rz) mat4.rotateZ(m, m, rz);
    mat4.scale(m, m, [spec.scale, spec.scale, spec.scale]);
    return { model: spec.model, matrix: m };
  }

  serialize() {
    return { pos: this.pos, yaw: this.yaw };
  }

  load(data) {
    this.pos = [...data.pos];
    this.yaw = data.yaw;
  }
}
