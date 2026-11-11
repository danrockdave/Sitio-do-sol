/**
 * Production machines in the shed (cheese press, jam pot, loom, oven) and
 * the beehive. Machines work through a queue of inputs, one unit at a time,
 * while in-game time passes; finished goods wait until they are collected.
 */

import { MACHINES } from './data.js';

export class Machine {
  constructor(id, state = null) {
    this.id = id;
    this.def = MACHINES[id];
    this.queue = [];          // recipe indices waiting (the first one is being made)
    this.progress = 0;        // hours spent on the current unit (or the beehive cycle)
    this.done = {};           // output item -> count ready to collect
    this.anim = 0;            // 0..1 smoothed "working" for the animation
    this.flash = 0;           // short glow when something is finished
    if (state) {
      this.queue = [...(state.queue || [])].filter((r) => this.def.recipes && this.def.recipes[r]);
      this.progress = state.progress || 0;
      this.done = { ...(state.done || {}) };
    }
  }

  get x() { return this.def.x; }
  get z() { return this.def.z; }

  get passive() {
    return !!this.def.passive;
  }

  get working() {
    return this.passive ? this.readyCount() < this.def.capacity : this.queue.length > 0;
  }

  readyCount() {
    return Object.values(this.done).reduce((a, b) => a + b, 0);
  }

  /** Room left in the input queue. */
  room() {
    return this.passive ? 0 : this.def.capacity - this.queue.length;
  }

  currentRecipe() {
    return this.queue.length ? this.def.recipes[this.queue[0]] : null;
  }

  /** Hours until the current unit is ready (null when idle). */
  hoursLeft(context = {}) {
    if (this.passive) return this.cycleHours(context) - this.progress;
    const recipe = this.currentRecipe();
    return recipe ? recipe.hours - this.progress : null;
  }

  cycleHours(context = {}) {
    const p = this.def.passive;
    return context.sunflowers >= 4 ? p.fastHours : p.hours;
  }

  /** Puts up to n units of recipe r in the queue (the caller removes the inputs). */
  enqueue(r, n) {
    const amount = Math.max(0, Math.min(n, this.room()));
    for (let k = 0; k < amount; k++) this.queue.push(r);
    return amount;
  }

  /**
   * Advances production by in-game hours. Returns the list of finished items.
   * context.sunflowers: grown sunflowers in the field (speeds up the bees).
   */
  update(hours, dt, context = {}) {
    const finished = [];
    let left = hours;
    if (this.passive) {
      if (this.readyCount() < this.def.capacity) {
        this.progress += left;
        const cycle = this.cycleHours(context);
        if (this.progress >= cycle) {
          this.progress -= cycle;
          const out = this.def.passive.output;
          this.done[out] = (this.done[out] || 0) + 1;
          finished.push(out);
        }
      }
    } else {
      while (left > 0 && this.queue.length) {
        const recipe = this.def.recipes[this.queue[0]];
        const need = recipe.hours - this.progress;
        if (left >= need) {
          left -= need;
          this.progress = 0;
          this.queue.shift();
          this.done[recipe.output] = (this.done[recipe.output] || 0) + 1;
          finished.push(recipe.output);
        } else {
          this.progress += left;
          left = 0;
        }
      }
    }
    if (finished.length) this.flash = 1;
    this.anim += ((this.working ? 1 : 0) - this.anim) * (1 - Math.exp(-dt * 3));
    this.flash = Math.max(0, this.flash - dt * 0.8);
    return finished;
  }

  /** Takes everything ready. Returns { item: count } (empty object when nothing). */
  collect() {
    const out = this.done;
    this.done = {};
    return out;
  }

  serialize() {
    return { id: this.id, queue: this.queue, progress: this.progress, done: this.done };
  }
}
