/**
 * Item counts carried by the farmer.
 */

import { ITEMS } from './data.js';

export class Inventory {
  constructor() {
    this.counts = {};
  }

  count(id) {
    return this.counts[id] || 0;
  }

  add(id, amount = 1) {
    this.counts[id] = this.count(id) + amount;
  }

  remove(id, amount = 1) {
    const have = this.count(id);
    if (have < amount) return false;
    this.counts[id] = have - amount;
    return true;
  }

  /** Items of a given kind with a positive count, in ITEMS order. */
  listByKind(kind) {
    return Object.keys(ITEMS).filter((id) => ITEMS[id].kind === kind && this.count(id) > 0);
  }

  sellValue() {
    return this.listByKind('produce').reduce((sum, id) => sum + ITEMS[id].sell * this.count(id), 0);
  }

  serialize() {
    return { ...this.counts };
  }

  load(data) {
    this.counts = { ...data };
  }
}
