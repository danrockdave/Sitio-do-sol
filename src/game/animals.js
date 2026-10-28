/**
 * Farm animals: wander inside their pen, produce eggs / milk / wool on a
 * timer and are animated with per-part rotations (legs, head, wings, tail).
 */

import { ANIMALS } from './data.js';
import { PENS } from './world.js';
import { pivotRotation, placement, angleLerp } from './animate.js';

const BUBBLE_HEIGHT = { chicken: 0.85, cow: 1.75, sheep: 1.45 };
let nextId = 1;

export class Animal {
  constructor(type, random = Math.random, state = null) {
    this.id = nextId++;
    this.type = type;
    this.def = ANIMALS[type];
    this.pen = PENS[this.def.building];
    this.random = random;
    const m = this.def.radius + 0.4;
    this.pos = [
      this.pen.minX + m + random() * (this.pen.maxX - this.pen.minX - 2 * m),
      0,
      this.pen.minZ + m + random() * (this.pen.maxZ - this.pen.minZ - 2 * m),
    ];
    this.yaw = random() * Math.PI * 2;
    this.state = 'idle';
    this.timer = 1 + random() * 3;
    this.target = null;
    this.phase = random() * 10;
    this.idleAction = 0;        // 0..1 progress of a peck / graze
    this.hoursLeft = this.def.hours * (0.3 + random() * 0.6);
    this.ready = false;
    this.joy = 0;               // little hop after being collected from
    if (state) Object.assign(this, state);
  }

  get bubbleHeight() {
    return BUBBLE_HEIGHT[this.type] || 1.2;
  }

  update(dt, hours, others) {
    // production timer (in-game hours)
    if (!this.ready) {
      this.hoursLeft -= hours;
      if (this.hoursLeft <= 0) this.ready = true;
    }
    this.joy = Math.max(0, this.joy - dt * 1.5);

    const m = this.def.radius + 0.25;
    if (this.state === 'idle') {
      this.timer -= dt;
      this.idleAction = Math.max(0, this.idleAction - dt * 0.8);
      if (this.random() < dt * 0.25) this.idleAction = 1;
      if (this.timer <= 0) {
        this.state = 'walk';
        this.timer = 6;
        this.target = [
          this.pen.minX + m + this.random() * (this.pen.maxX - this.pen.minX - 2 * m),
          this.pen.minZ + m + this.random() * (this.pen.maxZ - this.pen.minZ - 2 * m),
        ];
      }
    } else {
      this.timer -= dt;
      const dx = this.target[0] - this.pos[0];
      const dz = this.target[1] - this.pos[2];
      const dist = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      this.yaw = angleLerp(this.yaw, desired, 1 - Math.exp(-dt * 4));
      const facing = Math.cos(desired - this.yaw);
      if (facing > 0.5) {
        const step = Math.min(dist, this.def.speed * dt * facing);
        this.pos[0] += Math.sin(this.yaw) * step;
        this.pos[2] += Math.cos(this.yaw) * step;
        this.phase += dt * this.def.speed * (this.type === 'chicken' ? 16 : 7);
      }
      if (dist < 0.15 || this.timer <= 0) {
        this.state = 'idle';
        this.timer = 2 + this.random() * 5;
      }
    }

    // keep distance from the other animals and stay inside the pen
    for (const other of others) {
      if (other === this) continue;
      const dx = this.pos[0] - other.pos[0];
      const dz = this.pos[2] - other.pos[2];
      const min = this.def.radius + other.def.radius;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 1e-4) {
        const push = (min - d) * 0.5;
        this.pos[0] += (dx / d) * push;
        this.pos[2] += (dz / d) * push;
      }
    }
    const r = this.def.radius;
    this.pos[0] = Math.min(this.pen.maxX - r, Math.max(this.pen.minX + r, this.pos[0]));
    this.pos[2] = Math.min(this.pen.maxZ - r, Math.max(this.pen.minZ + r, this.pos[2]));
  }

  collect() {
    if (!this.ready) return null;
    this.ready = false;
    this.hoursLeft = this.def.hours;
    this.joy = 1;
    return this.def.product;
  }

  /** Returns { matrix, pose } for the render queue. */
  pose(time, pivots) {
    const walking = this.state === 'walk';
    const s = Math.sin(this.phase);
    const pose = {};
    let y = 0;
    const hop = Math.sin(this.joy * Math.PI) * 0.35;

    if (this.type === 'chicken') {
      y = walking ? Math.abs(s) * 0.05 : 0;
      if (pivots.leg_l) pose.leg_l = pivotRotation(pivots.leg_l, walking ? s * 40 : 0);
      if (pivots.leg_r) pose.leg_r = pivotRotation(pivots.leg_r, walking ? -s * 40 : 0);
      const peck = Math.sin(this.idleAction * Math.PI) * 55;
      if (pivots.head) pose.head = pivotRotation(pivots.head, walking ? s * 8 : peck);
      const flap = this.joy > 0 ? Math.sin(time * 40) * 50 : Math.sin(time * 3 + this.phase) * 4;
      if (pivots.wing_l) pose.wing_l = pivotRotation(pivots.wing_l, 0, 0, -flap);
      if (pivots.wing_r) pose.wing_r = pivotRotation(pivots.wing_r, 0, 0, flap);
    } else {
      // quadrupeds: diagonal leg pairs swing together
      const swing = walking ? s * 24 : 0;
      if (pivots.leg_fl) pose.leg_fl = pivotRotation(pivots.leg_fl, swing);
      if (pivots.leg_br) pose.leg_br = pivotRotation(pivots.leg_br, swing);
      if (pivots.leg_fr) pose.leg_fr = pivotRotation(pivots.leg_fr, -swing);
      if (pivots.leg_bl) pose.leg_bl = pivotRotation(pivots.leg_bl, -swing);
      y = walking ? Math.abs(Math.cos(this.phase)) * 0.025 : 0;
      const graze = Math.sin(Math.min(1, this.idleAction * 1.2) * Math.PI) * 32;
      if (pivots.head) pose.head = pivotRotation(pivots.head, walking ? s * 4 : graze, Math.sin(time * 0.7 + this.phase) * 6);
      if (pivots.tail) pose.tail = pivotRotation(pivots.tail, 0, 0, Math.sin(time * 3.1 + this.phase) * 18);
    }
    const breathe = 1 + Math.sin(time * 2.2 + this.phase) * 0.012;
    const matrix = placement(this.pos[0], y + hop, this.pos[2], this.yaw, { scale: [1, breathe, 1] });
    return { matrix, pose };
  }

  serialize() {
    return { type: this.type, pos: this.pos, yaw: this.yaw, hoursLeft: this.hoursLeft, ready: this.ready };
  }
}
