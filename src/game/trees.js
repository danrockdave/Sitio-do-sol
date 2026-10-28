/**
 * Fruit trees: each tree has fruit slots on its crown that grow over time.
 * Fruits scale up and turn from green to their ripe colour.
 */

import { FRUIT_TREES } from './data.js';

// positions on the crown of fruit_tree.obj where fruits hang (model space)
export const FRUIT_SLOTS = [
  [0.40, 1.28, 0.80], [-0.52, 1.60, 0.70], [0.78, 1.72, 0.36], [-0.90, 1.34, 0.14],
  [0.12, 2.22, 0.58], [0.62, 1.16, -0.58], [-0.30, 1.12, 0.86],
];

export class FruitTree {
  constructor(spot, random = Math.random, state = null) {
    this.x = spot.x;
    this.z = spot.z;
    this.type = spot.type;
    this.def = FRUIT_TREES[spot.type];
    this.random = random;
    this.slots = FRUIT_SLOTS.map(() => ({ growth: 0.4 + random() * 0.8 }));
    this.shake = 0;
    if (state) {
      this.slots = FRUIT_SLOTS.map((_, k) => ({ growth: state.slots[k] ?? random() }));
    }
  }

  update(hours, dt) {
    for (const slot of this.slots) {
      slot.growth = Math.min(1, slot.growth + hours / this.def.hours);
    }
    this.shake = Math.max(0, this.shake - dt * 1.6);
  }

  readyCount() {
    return this.slots.filter((s) => s.growth >= 1).length;
  }

  collect() {
    let count = 0;
    for (const slot of this.slots) {
      if (slot.growth >= 1) {
        count++;
        slot.growth = -this.random() * 0.25;   // small stagger so fruits don't all regrow at once
      }
    }
    if (count) this.shake = 1;
    return count ? { produce: this.def.fruit, amount: count } : null;
  }

  serialize() {
    return { x: this.x, z: this.z, type: this.type, slots: this.slots.map((s) => s.growth) };
  }
}
