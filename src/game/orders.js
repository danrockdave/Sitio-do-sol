/**
 * Village orders pinned on the "Mural da Vila": businesses of the Vila do Sol
 * ask for products the farm can make right now and pay better than the
 * shipping bin. New orders arrive every morning; on Sundays a special order
 * pays even more. Orders never run out, so there is always something to do.
 */

import { ITEMS, CROPS, ANIMALS, FISH, MACHINES, REQUESTERS, ORDER_SLOTS } from './data.js';

const NORMAL_DAYS = 3;
const SPECIAL_DAYS = 4;
const MAX_AMOUNT = { crop: 10, fruit: 8, animal: 5, fish: 3, artisan: 3 };

let nextId = 1;

export class Orders {
  constructor() {
    this.list = [];             // { id, requester, item, amount, reward, xp, expires, special }
  }

  /** Items the farm can produce right now. */
  static pool(game) {
    const ids = new Set();
    const level = game.progress.level;
    for (const crop of Object.values(CROPS)) if (crop.level <= level) ids.add(crop.produce);
    for (const tree of game.trees) ids.add(tree.def.fruit);
    for (const animal of game.animals) ids.add(ANIMALS[animal.type].product);
    if (game.progress.rod) {
      for (const [species, fish] of Object.entries(FISH)) {
        if (fish.legendary) continue;
        if (species === 'lambari' || species === 'tilapia' || game.progress.found[fish.item]) ids.add(fish.item);
      }
    }
    for (const machine of game.machines) {
      const def = MACHINES[machine.id];
      if (def.passive) ids.add(def.passive.output);
      for (const recipe of def.recipes || []) if (ids.has(recipe.input)) ids.add(recipe.output);
    }
    return [...ids];
  }

  /** Removes expired orders and fills the empty slots. */
  refresh(game, random = Math.random) {
    const day = game.clock.day;
    const before = this.list.length;
    this.list = this.list.filter((o) => o.expires >= day);
    const expired = before - this.list.length;
    let added = 0;
    const normal = () => this.list.filter((o) => !o.special).length;
    while (normal() < ORDER_SLOTS) {
      const order = this._generate(game, random, false);
      if (!order) break;
      this.list.push(order);
      added++;
    }
    if (day % 7 === 0 && !this.list.some((o) => o.special)) {
      const order = this._generate(game, random, true);
      if (order) {
        this.list.push(order);
        added++;
      }
    }
    return { expired, added };
  }

  _generate(game, random, special) {
    const pool = Orders.pool(game);
    const taken = new Set(this.list.map((o) => o.item));
    const level = game.progress.level;
    for (let attempt = 0; attempt < 12; attempt++) {
      const requester = REQUESTERS[Math.floor(random() * REQUESTERS.length)];
      const wants = pool.filter((id) => !taken.has(id)
        && ((requester.likes && requester.likes.includes(id)) || (requester.cats && requester.cats.includes(ITEMS[id].cat))));
      if (!wants.length) continue;
      // special orders prefer the most valuable products
      let item;
      if (special) {
        wants.sort((a, b) => ITEMS[b].sell - ITEMS[a].sell);
        item = wants[Math.floor(random() * Math.min(3, wants.length))];
      } else {
        item = wants[Math.floor(random() * wants.length)];
      }
      const sell = ITEMS[item].sell;
      const target = (100 + 55 * level) * (0.7 + random() * 0.6) * (special ? 1.8 : 1);
      const max = MAX_AMOUNT[ITEMS[item].cat] || 5;
      const amount = Math.max(1, Math.min(max + (special ? 2 : 0), Math.round(target / sell)));
      const value = sell * amount;
      const bonus = (1.45 + random() * 0.25) * (special ? 1.6 : 1) * (1 + Math.max(0, level - 8) * 0.05);
      return {
        id: nextId++,
        requester: requester.name,
        item,
        amount,
        reward: Math.max(10, Math.round((value * bonus) / 5) * 5),
        xp: Math.round((25 + value / 18) * (special ? 1.5 : 1)),
        expires: game.clock.day + (special ? SPECIAL_DAYS : NORMAL_DAYS) - 1,
        special,
      };
    }
    return null;
  }

  canDeliver(order, inventory) {
    return inventory.count(order.item) >= order.amount;
  }

  remove(order) {
    this.list = this.list.filter((o) => o !== order);
  }

  serialize() {
    return this.list.map((o) => ({ ...o }));
  }

  load(data) {
    this.list = (data || []).filter((o) => ITEMS[o.item]).map((o) => ({ ...o, id: nextId++ }));
  }
}
