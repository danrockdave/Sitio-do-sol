/**
 * Game state and rules: ties together the clock, the field, animals, fruit
 * trees, the farmer, money, upgrades, the shop and the shipping bin.
 *
 * The UI talks to the game through methods (buy, sell, sleep, ...) and
 * receives events (open the shop, ask to sleep, goal reached, ...).
 */

import { vec3 } from '../../lib/gl-matrix/index.js';
import {
  ITEMS, CROPS, ANIMALS, UPGRADES, HOTBAR, START_MONEY, GOAL_MONEY, DAY_START_HOUR, SLEEP_FROM_HOUR,
} from './data.js';
import { Clock } from './clock.js';
import { Inventory } from './inventory.js';
import { Farm } from './farm.js';
import { Player } from './player.js';
import { Animal } from './animals.js';
import { FruitTree } from './trees.js';
import { Particles } from './particles.js';
import { ORCHARD_SPOTS } from './world.js';
import { storage } from '../core/bridge.js';

const TILE_REACH = 2.3;
const SAVE_KEY = 'sitio-do-sol-save-v1';

export class Game {
  constructor(world) {
    this.world = world;
    this.particles = new Particles();
    this.events = [];
    this.sounds = [];         // { name, pos, ...options } consumed by the audio engine
    this.toasts = [];
    this.floaters = [];
    this.hover = { tile: null, object: null, prompt: null };
    this.binOpen = 0;
    this.binTarget = 0;
    this.tapToWalk = false;   // touch devices: tapping something far away walks there first
    this.walkTarget = null;
    this.time = 0;
    this.newGame();
  }

  // ------------------------------------------------------------------
  // lifecycle
  // ------------------------------------------------------------------

  newGame() {
    this.clock = new Clock();
    this.clock.hour = 7;
    this.inventory = new Inventory();
    this.inventory.add('seed_carrot', 8);
    this.inventory.add('seed_tomato', 3);
    this.farm = new Farm();
    this.player = new Player();
    this.money = START_MONEY;
    this.totalEarned = 0;
    this.goalReached = false;
    this.upgrades = { field: 0, can: 0, coop: 0, barn: 0, orchard: 0 };
    this.selected = 0;
    this.animals = [new Animal('chicken'), new Animal('chicken'), new Animal('cow')];
    this.trees = ORCHARD_SPOTS.slice(0, 2).map((spot) => new FruitTree(spot));
    this.applyField();
    this.stats = { harvested: 0, sold: 0 };
  }

  serialize() {
    return {
      version: 1,
      savedAt: Date.now(),
      clock: this.clock.serialize(),
      money: this.money,
      totalEarned: this.totalEarned,
      goalReached: this.goalReached,
      inventory: this.inventory.serialize(),
      farm: this.farm.serialize(),
      player: this.player.serialize(),
      upgrades: this.upgrades,
      selected: this.selected,
      animals: this.animals.map((a) => a.serialize()),
      trees: this.trees.map((t) => t.serialize()),
      stats: this.stats,
    };
  }

  load(data) {
    this.newGame();
    this.clock.load(data.clock);
    this.money = data.money;
    this.totalEarned = data.totalEarned || 0;
    this.goalReached = !!data.goalReached;
    this.inventory.load(data.inventory);
    this.farm.load(data.farm);
    this.player.load(data.player);
    this.upgrades = { ...this.upgrades, ...data.upgrades };
    this.selected = data.selected || 0;
    this.animals = data.animals.map((a) => new Animal(a.type, Math.random, {
      pos: [...a.pos], yaw: a.yaw, hoursLeft: a.hoursLeft, ready: a.ready,
    }));
    this.trees = data.trees.map((t) => new FruitTree(t, Math.random, t));
    this.stats = data.stats || this.stats;
    this.applyField();
  }

  static hasSave() {
    return !!storage.get(SAVE_KEY);
  }

  save() {
    return storage.set(SAVE_KEY, JSON.stringify(this.serialize()));
  }

  loadSaved() {
    try {
      const raw = storage.get(SAVE_KEY);
      if (!raw) return false;
      this.load(JSON.parse(raw));
      return true;
    } catch (err) {
      console.warn('Save inválido', err);
      return false;
    }
  }

  /** Decorative farm shown behind the title screen. */
  showcase() {
    this.newGame();
    const b = this.farm.bounds();
    const types = ['carrot', 'tomato', 'corn', 'pumpkin', 'carrot', 'corn'];
    for (let j = b.j0; j < b.j1; j++) {
      for (let i = b.i0; i < b.i1; i++) {
        this.farm.till(i, j);
        const type = types[(j - b.j0) % types.length];
        this.farm.plant(i, j, type);
        const tile = this.farm.get(i, j);
        const stage = Math.min(4, 1 + ((i * 7 + j * 3) % 4));
        tile.crop.growth = stage * CROPS[type].hoursPerStage;
        tile.wet = (i + j) % 3 === 0 ? 10 : 0;
        tile.pop = 0;
      }
    }
    this.animals.push(new Animal('sheep'), new Animal('cow'), new Animal('chicken'));
    this.animals.forEach((a, k) => { a.ready = k % 2 === 0; });
    for (const tree of this.trees) tree.slots.forEach((s) => { s.growth = 1; });
    this.player.pos = [-3.8, 0, 2.4];
    this.player.yaw = 0.8;
  }

  /** Ambient animation without game time passing (title screen). */
  idle(dt) {
    this.time += dt;
    this.particles.update(dt);
    this.farm.animate(dt);
    for (const animal of this.animals) animal.update(dt, 0, this.animals);
    for (const tree of this.trees) tree.update(0, dt);
    this.binOpen += (this.binTarget - this.binOpen) * (1 - Math.exp(-dt * 8));
  }

  applyField() {
    this.farm.size = UPGRADES.field.levels[this.upgrades.field];
    this.world.paintFieldArea(this.farm.size);
    this.fieldDirty = true;
  }

  // ------------------------------------------------------------------
  // per-frame update
  // ------------------------------------------------------------------

  /**
   * controls = { move: [x, z], running, use, interact, ray, rayFromMouse, select }
   * paused: menus open (the world freezes, like most farming games)
   */
  update(dt, controls, paused) {
    this.time += dt;
    this.binOpen += (this.binTarget - this.binOpen) * (1 - Math.exp(-dt * 8));
    this._updateFeedback(dt);
    if (paused) return;

    const hours = this.clock.tick(dt);
    this._simulate(hours, dt);

    if (controls.select !== null && controls.select !== undefined) this.selected = controls.select;

    const extra = this._dynamicColliders();
    const walk = this._followWalkTarget(dt, controls);
    this.player.update(dt, walk.move, walk.running, this.world, extra);
    this._footsteps();
    this._animalCalls(dt);
    this._updateHover(controls);

    if (controls.use) this._use(controls);
    if (controls.interact) this._interactNearest();

    if (!this.goalReached && this.money >= GOAL_MONEY) {
      this.goalReached = true;
      this.events.push({ type: 'goal' });
    }
  }

  _simulate(hours, dt) {
    const grown = this.farm.update(hours);
    for (const tile of grown) {
      if (this.farm.isRipe(tile.crop)) {
        const pos = [tile.i + 0.5, 0.5, tile.j + 0.5];
        this.particles.emit(pos, 6, { color: [1, 0.95, 0.5, 1], speed: 0.6, up: 1.6, gravity: 2, life: 0.9, size: 0.1 });
        this.sound('ripe', pos, { volume: 0.7 });
      }
    }
    this.farm.animate(dt);
    for (const animal of this.animals) animal.update(dt, hours, this.animals);
    for (const tree of this.trees) tree.update(hours, dt);
  }

  sound(name, pos = null, options = {}) {
    this.sounds.push({ name, pos, ...options });
  }

  /** One footstep sound per half walk cycle, softer on grass than on dirt. */
  _footsteps() {
    const p = this.player;
    const step = Math.floor(p.phase / Math.PI);
    if (step !== this._lastStep && p.moving > 0.5) {
      const surface = this.world.dirtAt(p.pos[0], p.pos[2]) > 0.45 ? 'dirt' : 'grass';
      this.sound('step', null, { surface, volume: p.running ? 1 : 0.8 });
    }
    this._lastStep = step;
  }

  /** Animals near the farmer call out now and then. */
  _animalCalls(dt) {
    for (const animal of this.animals) {
      animal.callTimer = (animal.callTimer ?? Math.random() * 10) - dt;
      if (animal.callTimer > 0) continue;
      animal.callTimer = { chicken: 7, cow: 16, sheep: 13 }[animal.type] * (0.6 + Math.random() * 0.9);
      if (this._distanceToPlayer(animal.pos[0], animal.pos[2]) < 16) {
        this.sound(animal.type, [animal.pos[0], 1, animal.pos[2]], { volume: 0.55, ambient: true });
      }
    }
  }

  _dynamicColliders() {
    const list = this.trees.map((t) => ({ type: 'circle', x: t.x, z: t.z, r: 0.35 }));
    for (const a of this.animals) list.push({ type: 'circle', x: a.pos[0], z: a.pos[2], r: a.def.radius * 0.7 });
    return list;
  }

  get tool() {
    return HOTBAR[this.selected];
  }

  // ------------------------------------------------------------------
  // targeting
  // ------------------------------------------------------------------

  /** Everything the farmer can interact with (buildings, animals, trees). */
  interactables() {
    const list = this.world.interactables.map((it) => ({ ...it, reach: it.radius + 0.6 }));
    const house = list.find((it) => it.type === 'house');
    if (house && !this.canSleep()) house.label = 'Casa (dá para dormir depois das 18:00)';
    for (const animal of this.animals) {
      list.push({
        type: 'animal', ref: animal, x: animal.pos[0], z: animal.pos[2], height: animal.bubbleHeight * 0.6,
        radius: animal.def.radius + 0.15, reach: animal.def.radius + 1.4,
        label: animal.ready ? `Coletar ${ITEMS[animal.def.product].name.toLowerCase()}` : `Fazer carinho na ${animal.def.name.toLowerCase()}`,
      });
    }
    for (const tree of this.trees) {
      const n = tree.readyCount();
      list.push({
        type: 'tree', ref: tree, x: tree.x, z: tree.z, height: 1.6, radius: 0.9, reach: 2.2,
        label: n ? `Colher ${n} ${n > 1 ? `${ITEMS[tree.def.fruit].name.toLowerCase()}s` : ITEMS[tree.def.fruit].name.toLowerCase()}` : `${tree.def.name} (frutos crescendo)`,
      });
    }
    return list;
  }

  _distanceToPlayer(x, z) {
    return Math.hypot(x - this.player.pos[0], z - this.player.pos[2]);
  }

  _updateHover(controls) {
    this.hover.tile = null;
    this.hover.object = null;
    const ray = controls.ray;
    const candidates = this.interactables();

    if (ray && controls.rayFromMouse) {
      // object under the mouse (ray vs sphere)
      let best = null;
      for (const c of candidates) {
        const center = [c.x, c.height, c.z];
        const t = raySphere(ray.origin, ray.dir, center, c.radius + 0.25);
        if (t !== null && (!best || t < best.t)) best = { t, c };
      }
      if (best) {
        this.hover.object = { ...best.c, inReach: this._distanceToPlayer(best.c.x, best.c.z) <= best.c.reach };
      }
      // tile under the mouse (ray vs ground plane y = 0)
      if (!this.hover.object && Math.abs(ray.dir[1]) > 1e-4) {
        const t = -ray.origin[1] / ray.dir[1];
        if (t > 0) {
          const x = ray.origin[0] + ray.dir[0] * t;
          const z = ray.origin[2] + ray.dir[2] * t;
          this.hover.tile = this._tileInfo(Math.floor(x), Math.floor(z));
        }
      }
    }
    if (!this.hover.tile && !this.hover.object) {
      // keyboard targeting: the tile right in front of the farmer
      const [fx, fz] = this.player.forward();
      const tile = this._tileInfo(Math.floor(this.player.pos[0] + fx * 0.85), Math.floor(this.player.pos[2] + fz * 0.85));
      if (tile.inField) this.hover.tile = { ...tile, keyboard: true };
    }

    // prompt for the nearest interactable in reach (E key)
    const near = this._nearestInteractable(candidates);
    this.hover.prompt = near ? near.label : null;
  }

  _tileInfo(i, j) {
    const tool = this.tool;
    const seedCount = tool.startsWith('seed_') ? this.inventory.count(tool) : 0;
    let action = this.farm.actionFor(tool, i, j, seedCount);
    const tile = this.farm.get(i, j);
    if (!action && tile && tile.crop && this.farm.isRipe(tile.crop) && tool !== 'hoe' && tool !== 'watering_can') {
      action = 'harvest';
    }
    const inReach = this._distanceToPlayer(i + 0.5, j + 0.5) <= TILE_REACH;
    return { i, j, action, inReach, inField: this.farm.inField(i, j) };
  }

  _nearestInteractable(candidates) {
    let best = null;
    for (const c of candidates) {
      const d = this._distanceToPlayer(c.x, c.z);
      if (d <= c.reach && (!best || d < best.d)) best = { d, c };
    }
    return best ? best.c : null;
  }

  // ------------------------------------------------------------------
  // actions
  // ------------------------------------------------------------------

  _use(controls) {
    if (this.player.busy) return;
    const obj = this.hover.object;
    if (obj) {
      if (obj.inReach) this._interact(obj);
      else if (this.tapToWalk && controls.rayFromMouse) this._walkTo({ kind: 'object', type: obj.type, ref: obj.ref || null });
      else this._refuse('Chegue mais perto.');
      return;
    }
    const tile = this.hover.tile;
    if (!tile) return;
    if (!tile.inField) {
      if (controls.rayFromMouse && this.tool === 'hoe') this._refuse('Só dá para arar dentro da plantação.');
      return;
    }
    if (!tile.inReach) {
      if (this.tapToWalk && controls.rayFromMouse) {
        this._walkTo({ kind: 'tile', i: tile.i, j: tile.j });
        return;
      }
      this._refuse('Chegue mais perto.');
      return;
    }
    if (!tile.action) {
      this._explainNoAction(tile);
      return;
    }
    this._tileAction(tile);
  }

  _refuse(text, kind = 'info') {
    this.toast(text, kind);
    this.sound('error', null, { volume: 0.7 });
  }

  // ------------------------------------------------------------------
  // tap to walk (touch devices)
  // ------------------------------------------------------------------

  _walkTo(target) {
    this.walkTarget = { ...target, time: 0, stuck: 0, lastDistance: null, current: null };
  }

  _findWalkObject(target) {
    return this.interactables().find((c) => (target.ref ? c.ref === target.ref : c.type === target.type)) || null;
  }

  /** Steers the farmer toward the pending target; joystick or keys cancel it. */
  _followWalkTarget(dt, controls) {
    const manual = { move: controls.move, running: controls.running };
    const w = this.walkTarget;
    if (!w) return manual;
    if (Math.hypot(controls.move[0], controls.move[1]) > 0.1) {
      this.walkTarget = null;
      return manual;
    }
    const p = this.player.pos;
    let tx;
    let tz;
    let reach;
    if (w.kind === 'tile') {
      tx = w.i + 0.5;
      tz = w.j + 0.5;
      reach = TILE_REACH - 0.6;
    } else {
      w.current = this._findWalkObject(w);
      if (!w.current) {
        this.walkTarget = null;
        return manual;
      }
      tx = w.current.x;
      tz = w.current.z;
      reach = w.current.reach - 0.4;
    }
    const dx = tx - p[0];
    const dz = tz - p[2];
    const distance = Math.hypot(dx, dz);
    if (distance <= reach) {
      this.walkTarget = null;
      if (w.kind === 'tile') {
        const info = this._tileInfo(w.i, w.j);
        if (info.action) this._tileAction(info);
        else this._explainNoAction(info);
      } else {
        this._interact(w.current);
      }
      return { move: [0, 0], running: false };
    }
    w.time += dt;
    if (w.lastDistance !== null && w.lastDistance - distance < dt * 0.5) w.stuck += dt;
    else w.stuck = 0;
    w.lastDistance = distance;
    if (w.stuck > 0.8 || w.time > 10) {
      this.walkTarget = null;
      this._refuse('Não dá para chegar até lá por aqui.');
      return { move: [0, 0], running: false };
    }
    return { move: [dx / distance, dz / distance], running: distance > 6 };
  }

  _explainNoAction(tile) {
    const t = this.farm.get(tile.i, tile.j);
    const tool = this.tool;
    this.sound('error', null, { volume: 0.6 });
    if (tool.startsWith('seed_')) {
      if (this.inventory.count(tool) === 0) this.toast(`Sem ${ITEMS[tool].name.toLowerCase()}. Compre na loja.`, 'bad');
      else if (!t || !t.tilled) this.toast('Use a enxada para preparar a terra primeiro.', 'info');
      else if (t.crop) this.toast('Este canteiro já está plantado.', 'info');
    } else if (tool === 'watering_can') {
      this.toast('Prepare a terra com a enxada antes de regar.', 'info');
    } else if (tool === 'basket' && t && t.crop) {
      this.toast('Ainda não está pronto para colher.', 'info');
    }
  }

  _tileAction(tile) {
    const { i, j, action } = tile;
    const cx = i + 0.5;
    const cz = j + 0.5;
    this.player.startAction(action, cx, cz);
    switch (action) {
      case 'till':
        this.farm.till(i, j);
        this.sound('till', [cx, 0, cz]);
        this.particles.emit([cx, 0.1, cz], 10, { color: [0.45, 0.3, 0.2, 1], speed: 1.2, up: 2.2, life: 0.6, size: 0.12 });
        break;
      case 'clear':
        this.farm.clear(i, j);
        this.toast('Planta arrancada.', 'info');
        this.sound('clear', [cx, 0, cz]);
        this.particles.emit([cx, 0.2, cz], 8, { color: [0.4, 0.65, 0.25, 1], speed: 1, up: 2, life: 0.6 });
        break;
      case 'water': {
        this.sound('water', [cx, 0, cz]);
        const area = UPGRADES.can.levels[this.upgrades.can];
        const r = area === 3 ? 1 : 0;
        for (let di = -r; di <= r; di++) {
          for (let dj = -r; dj <= r; dj++) {
            if (this.farm.water(i + di, j + dj)) {
              this.particles.emit([cx + di, 0.35, cz + dj], 6, { color: [0.45, 0.7, 1, 0.9], speed: 0.6, up: 1.2, gravity: 8, life: 0.5, size: 0.08 });
            }
          }
        }
        break;
      }
      case 'plant': {
        const seed = this.tool;
        this.inventory.remove(seed, 1);
        this.farm.plant(i, j, ITEMS[seed].crop);
        this.sound('plant', [cx, 0, cz]);
        this.particles.emit([cx, 0.15, cz], 6, { color: [0.75, 0.9, 0.4, 1], speed: 0.6, up: 1.5, life: 0.5, size: 0.08 });
        break;
      }
      case 'harvest': {
        const result = this.farm.harvest(i, j);
        if (result) {
          this._gain(result.produce, result.amount, [cx, 0.8, cz]);
          this.sound('harvest', [cx, 0, cz]);
        }
        break;
      }
      default:
        break;
    }
  }

  _interactNearest() {
    if (this.player.busy) return;
    const near = this._nearestInteractable(this.interactables());
    if (near) this._interact(near);
  }

  _interact(obj) {
    switch (obj.type) {
      case 'shop':
        this.events.push({ type: 'shop' });
        break;
      case 'bin':
        this.binTarget = 1;
        this.sound('bin', [this.world.bin.x, 0.5, this.world.bin.z]);
        this.events.push({ type: 'sell' });
        break;
      case 'house':
        if (this.canSleep()) this.events.push({ type: 'sleep' });
        else this._refuse('Ainda é cedo para dormir. Volte depois das 18:00.');
        break;
      case 'animal': {
        const animal = obj.ref;
        this.player.startAction('collect', animal.pos[0], animal.pos[2]);
        const product = animal.collect();
        const voicePos = [animal.pos[0], 1, animal.pos[2]];
        this.sound(animal.type, voicePos);
        if (product) {
          this._gain(product, 1, [animal.pos[0], animal.bubbleHeight, animal.pos[2]]);
          this.sound('collect', voicePos);
        } else {
          this.sound('pet', voicePos);
          animal.joy = 1;
          this.particles.emit([animal.pos[0], animal.bubbleHeight, animal.pos[2]], 5, { color: [1, 0.45, 0.6, 1], speed: 0.4, up: 1.2, gravity: -0.5, life: 1.0, size: 0.14 });
          const hours = Math.ceil(animal.hoursLeft);
          this.toast(`${animal.def.name} feliz! Produz de novo em ~${hours}h.`, 'info');
        }
        break;
      }
      case 'tree': {
        const tree = obj.ref;
        this.player.startAction('harvest', tree.x, tree.z);
        const result = tree.collect();
        if (result) {
          this._gain(result.produce, result.amount, [tree.x, 2.0, tree.z]);
          this.sound('fruit', [tree.x, 1, tree.z]);
        } else {
          this._refuse('As frutas ainda estão crescendo.');
        }
        break;
      }
      default:
        break;
    }
  }

  _gain(itemId, amount, pos) {
    this.inventory.add(itemId, amount);
    this.stats.harvested += amount;
    this.floater(`+${amount} ${ITEMS[itemId].name}`, pos, [1, 0.97, 0.75, 1], itemId);
    this.particles.emit(pos, 10, { color: [1, 0.9, 0.4, 1], speed: 1.2, up: 2.4, gravity: 5, life: 0.7, size: 0.1 });
  }

  // ------------------------------------------------------------------
  // shop, selling, upgrades, sleep
  // ------------------------------------------------------------------

  animalCapacity(building) {
    return UPGRADES[building].levels[this.upgrades[building]];
  }

  animalCount(building) {
    return this.animals.filter((a) => a.def.building === building).length;
  }

  /** Describes a shop entry for the UI: { name, price, canBuy, reason, detail } */
  shopEntry(id) {
    if (ITEMS[id] && ITEMS[id].kind === 'seed') {
      const item = ITEMS[id];
      const crop = CROPS[item.crop];
      const hours = crop.hoursPerStage * 4;
      return {
        id, kind: 'seed', icon: item.icon, name: item.name, price: item.price,
        detail: `Colheita em ${hours}h regadas · vende por R$ ${ITEMS[crop.produce].sell}${crop.regrowStage !== null ? ' · rebrota' : ''}`,
        owned: this.inventory.count(id), canBuy: this.money >= item.price,
        reason: this.money >= item.price ? null : 'Dinheiro insuficiente',
      };
    }
    if (ANIMALS[id]) {
      const def = ANIMALS[id];
      const cap = this.animalCapacity(def.building);
      const count = this.animalCount(def.building);
      const full = count >= cap;
      return {
        id, kind: 'animal', icon: id, name: def.name, price: def.price,
        detail: `${ITEMS[def.product].name} a cada ${def.hours}h · ${def.building === 'coop' ? 'galinheiro' : 'celeiro'} ${count}/${cap}`,
        canBuy: !full && this.money >= def.price,
        reason: full ? 'Sem espaço: amplie a construção' : this.money >= def.price ? null : 'Dinheiro insuficiente',
      };
    }
    const up = UPGRADES[id];
    const level = this.upgrades[id];
    const maxed = level >= up.levels.length - 1;
    const price = maxed ? 0 : up.costs[level + 1];
    return {
      id, kind: 'upgrade', icon: up.icon, name: up.name, price,
      detail: maxed ? `${up.desc} Nível máximo (${up.describe(up.levels[level])}).`
        : `${up.desc} ${up.describe(up.levels[level])} » ${up.describe(up.levels[level + 1])}`,
      canBuy: !maxed && this.money >= price,
      reason: maxed ? 'Nível máximo' : this.money >= price ? null : 'Dinheiro insuficiente',
      maxed,
    };
  }

  buy(id, quantity = 1) {
    const entry = this.shopEntry(id);
    if (!entry.canBuy) {
      if (entry.reason) this._refuse(entry.reason, 'bad');
      return false;
    }
    if (entry.kind === 'seed') {
      const n = Math.min(quantity, Math.floor(this.money / entry.price));
      this.money -= entry.price * n;
      this.inventory.add(id, n);
      this.toast(`Comprou ${n}x ${entry.name.toLowerCase()}.`, 'good');
      this.sound('buy');
      const slot = HOTBAR.indexOf(id);
      if (slot >= 0 && !HOTBAR[this.selected].startsWith('seed_')) this.selected = slot;
    } else if (entry.kind === 'animal') {
      this.money -= entry.price;
      const animal = new Animal(id);
      this.animals.push(animal);
      animal.joy = 1;
      this.toast(`${entry.name} chegou ao sítio!`, 'good');
      this.sound('buy');
      this.sound(id, null, { volume: 0.8 });
    } else {
      this.money -= entry.price;
      this.upgrades[id] += 1;
      if (id === 'field') this.applyField();
      if (id === 'orchard') {
        const count = UPGRADES.orchard.levels[this.upgrades.orchard];
        for (let k = this.trees.length; k < count; k++) this.trees.push(new FruitTree(ORCHARD_SPOTS[k]));
      }
      this.toast(`Melhoria comprada: ${entry.name}!`, 'good');
      this.sound('upgrade');
      this.particles.emit([this.player.pos[0], 1.5, this.player.pos[2]], 20, { color: [1, 0.85, 0.3, 1], speed: 2, up: 3, life: 1 });
    }
    return true;
  }

  sell(id, quantity) {
    const have = this.inventory.count(id);
    const n = Math.min(have, quantity);
    if (n <= 0) return 0;
    this.inventory.remove(id, n);
    const value = ITEMS[id].sell * n;
    this.money += value;
    this.totalEarned += value;
    this.stats.sold += n;
    return value;
  }

  sellAll() {
    let total = 0;
    for (const id of this.inventory.listByKind('produce')) total += this.sell(id, this.inventory.count(id));
    return total;
  }

  announceSale(total) {
    if (total <= 0) return;
    this.sound('sell');
    const pos = [this.world.bin.x, 1.2, this.world.bin.z];
    this.floater(`+R$ ${total}`, pos, [1, 0.88, 0.3, 1], 'coin');
    this.particles.emit(pos, 16, { color: [1, 0.85, 0.25, 1], speed: 1.5, up: 3, life: 0.9, size: 0.12 });
  }

  closeBin() {
    this.binTarget = 0;
  }

  canSleep() {
    const h = this.clock.hour;
    return h >= SLEEP_FROM_HOUR || h < 4;
  }

  /** Skips the night (simulating growth and production) and saves. */
  sleep() {
    const hours = this.clock.hoursUntil(DAY_START_HOUR);
    const step = 0.25;
    for (let t = 0; t < hours; t += step) {
      const h = Math.min(step, hours - t);
      this.farm.update(h);
      for (const animal of this.animals) {
        if (!animal.ready) {
          animal.hoursLeft -= h;
          if (animal.hoursLeft <= 0) animal.ready = true;
        }
      }
      for (const tree of this.trees) tree.update(h, 0);
    }
    this.clock.advanceHours(hours);
    this.clock.hour = DAY_START_HOUR;
    this.player.pos = [-9.4, 0, -8.6];
    this.player.yaw = 0;
    const saved = this.save();
    this.toast(saved ? `Bom dia! Dia ${this.clock.day} · jogo salvo.` : `Bom dia! Dia ${this.clock.day}.`, 'good');
  }

  // ------------------------------------------------------------------
  // feedback: toasts and floating texts
  // ------------------------------------------------------------------

  toast(text, kind = 'info') {
    if (this.toasts.length && this.toasts[this.toasts.length - 1].text === text) {
      this.toasts[this.toasts.length - 1].t = 0;
      return;
    }
    this.toasts.push({ text, kind, t: 0 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  floater(text, pos, color, icon) {
    this.floaters.push({ text, pos: vec3.clone(pos), color, icon, t: 0 });
  }

  _updateFeedback(dt) {
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 3.2);
    for (const f of this.floaters) {
      f.t += dt;
      f.pos[1] += dt * 0.9;
    }
    this.floaters = this.floaters.filter((f) => f.t < 1.6);
    this.particles.update(dt);
  }
}

function raySphere(origin, dir, center, radius) {
  const ox = origin[0] - center[0];
  const oy = origin[1] - center[1];
  const oz = origin[2] - center[2];
  const b = ox * dir[0] + oy * dir[1] + oz * dir[2];
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}
