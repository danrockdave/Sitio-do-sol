/**
 * Game state and rules: ties together the clock and the weather, the field,
 * animals, fruit trees, the shed machines, fishing, the farmer, money,
 * experience, the story chapters, village orders and letters.
 *
 * The UI talks to the game through methods (buy, sell, deliverOrder, ...)
 * and receives events (open the shop, read a letter, a chapter ended, ...).
 */

import { vec3 } from '../../lib/gl-matrix/index.js';
import {
  ITEMS, CROPS, ANIMALS, UPGRADES, MACHINES, TOOLS, CHAPTERS, START_MONEY, DAY_START_HOUR, SLEEP_FROM_HOUR,
  ORDER_SLOTS, harvestXp,
} from './data.js';
import { Clock } from './clock.js';
import { Inventory } from './inventory.js';
import { Farm } from './farm.js';
import { Player } from './player.js';
import { Animal, MAX_LOVE } from './animals.js';
import { FruitTree } from './trees.js';
import { Particles } from './particles.js';
import { Progress } from './progress.js';
import { Orders } from './orders.js';
import { Machine } from './machines.js';
import { Fishing, WATER_Y } from './fishing.js';
import { Weather, WEATHER } from './weather.js';
import { ORCHARD_SPOTS, inPond } from './world.js';
import { storage } from '../core/bridge.js';

const TILE_REACH = 2.3;
const SAVE_KEY = 'sitio-do-sol-save-v1';
const SAVE_VERSION = 2;
const ORDER_COOLDOWN_HOURS = 4;
const OLD_HOTBAR = ['hoe', 'watering_can', 'basket', 'seed_carrot', 'seed_tomato', 'seed_corn', 'seed_pumpkin'];
const ANIMAL_CALL = { chicken: 7, cow: 16, sheep: 13, duck: 9, goat: 14, pig: 12 };

export class Game {
  constructor(world) {
    this.world = world;
    this.particles = new Particles();
    this.events = [];
    this.sounds = [];         // { name, pos, ...options } consumed by the audio engine
    this.toasts = [];
    this.floaters = [];
    this.banners = [];        // big centred messages: level up, chapters
    this.hover = { tile: null, object: null, prompt: null, water: null };
    this.binOpen = 0;
    this.binTarget = 0;
    this.tapToWalk = false;   // touch devices: tapping something far away walks there first
    this.seedSlots = 5;       // seeds shown in the hotbar
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
    this.inventory.add('seed_lettuce', 4);
    this.inventory.add('seed_tomato', 3);
    this.farm = new Farm();
    this.player = new Player();
    this.money = START_MONEY;
    this.totalEarned = 0;
    this.upgrades = { field: 0, can: 0, coop: 0, barn: 0, orchard: 0, irrigation: 0 };
    this.selectedId = 'hoe';
    this.animals = [new Animal('chicken'), new Animal('chicken'), new Animal('cow')];
    this.trees = ORCHARD_SPOTS.slice(0, 2).map((spot) => new FruitTree(spot));
    this.machines = [];
    this.progress = new Progress();
    this.progress.startChapter(0);
    this.progress.addLetter('boas_vindas');
    this.orders = new Orders();
    this.orderTimer = 0;
    this.weather = new Weather();
    this.weather.update(0, true);
    this.fishing = new Fishing();
    this.lastDayStart = this.clock.day;
    this.banners = [];
    this.pending = [];
    this.walkTarget = null;
    this.applyField();
  }

  serialize() {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      clock: this.clock.serialize(),
      money: this.money,
      totalEarned: this.totalEarned,
      inventory: this.inventory.serialize(),
      farm: this.farm.serialize(),
      player: this.player.serialize(),
      upgrades: this.upgrades,
      selectedId: this.selectedId,
      animals: this.animals.map((a) => a.serialize()),
      trees: this.trees.map((t) => t.serialize()),
      machines: this.machines.map((m) => m.serialize()),
      progress: this.progress.serialize(),
      orders: this.orders.serialize(),
      orderTimer: this.orderTimer,
      weather: this.weather.serialize(),
      lastDayStart: this.lastDayStart,
    };
  }

  load(data) {
    this.newGame();
    this.clock.load(data.clock);
    this.money = data.money;
    this.totalEarned = data.totalEarned || 0;
    this.inventory.load(data.inventory);
    this.farm.load(data.farm);
    this.player.load(data.player);
    this.upgrades = { ...this.upgrades, ...data.upgrades };
    this.animals = data.animals.filter((a) => ANIMALS[a.type]).map((a) => new Animal(a.type, Math.random, {
      pos: [...a.pos], yaw: a.yaw, hoursLeft: a.hoursLeft, ready: a.ready,
      love: a.love || 0, pettedToday: !!a.pettedToday,
    }));
    this.trees = data.trees.map((t) => new FruitTree(t, Math.random, t));
    this.lastDayStart = data.lastDayStart ?? this.clock.day;

    if ((data.version || 1) < 2) {
      // saves from the first version: experience from the money earned so far,
      // the story starts at chapter 1 and the welcome letter is waiting
      this.selectedId = OLD_HOTBAR[data.selected || 0] || 'hoe';
      this.progress.addXp(this.totalEarned * 0.3);
      // credit what was already done, so a fully tilled field cannot block chapter 1
      const tiles = [...this.farm.tiles.values()].filter((t) => t.tilled);
      const old = data.stats || {};
      this.progress.stats = {
        till: tiles.length,
        plant: tiles.filter((t) => t.crop).length + (old.harvested || 0),
        harvest: old.harvested || 0,
        sell: old.sold || 0,
      };
      this.progress.startChapter(0);
      this.progress.chapterStart = {};
    } else {
      this.selectedId = data.selectedId && ITEMS[data.selectedId] ? data.selectedId : 'hoe';
      this.machines = (data.machines || []).filter((m) => MACHINES[m.id]).map((m) => new Machine(m.id, m));
      this.progress.load(data.progress || {});
      this.orders.load(data.orders);
      this.orderTimer = data.orderTimer || 0;
      this.weather.load(data.weather);
    }
    if (this.progress.ordersOpen && !this.orders.list.length) this.orders.refresh(this);
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
    this.upgrades.field = 1;
    this.applyField();
    const b = this.farm.bounds();
    const types = ['sunflower', 'carrot', 'strawberry', 'corn', 'lettuce', 'pumpkin', 'watermelon', 'sunflower'];
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
    this.animals.push(new Animal('sheep'), new Animal('cow'), new Animal('chicken'), new Animal('duck'),
      new Animal('goat'), new Animal('pig'), new Animal('duck'));
    this.animals.forEach((a, k) => { a.ready = k % 2 === 0; });
    this.upgrades.orchard = 2;
    this.trees = ORCHARD_SPOTS.map((spot) => new FruitTree(spot));
    for (const tree of this.trees) tree.slots.forEach((s) => { s.growth = 1; });
    this.machines = Object.keys(MACHINES).map((id) => new Machine(id));
    this.machines.forEach((m, k) => { if (!m.passive && k % 2 === 0) m.queue.push(0); });
    this.progress.bloom = true;
    this.player.pos = [-3.8, 0, 2.4];
    this.player.yaw = 0.8;
  }

  /** Ambient animation without game time passing (title screen). */
  idle(dt) {
    this.time += dt;
    this.particles.update(dt);
    this.farm.animate(dt);
    this.weather.update(dt);
    for (const animal of this.animals) animal.update(dt, 0, this.animals);
    for (const tree of this.trees) tree.update(0, dt);
    for (const machine of this.machines) machine.update(0, dt);
    this.fishing.update(dt, this);
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

    for (const p of this.pending) p.t -= dt;
    for (const p of this.pending.filter((e) => e.t <= 0)) this.events.push(p.event);
    this.pending = this.pending.filter((e) => e.t > 0);

    const hours = this.clock.tick(dt);
    this._checkDayStart();
    this._simulate(hours, dt);
    this.weather.update(dt);

    if (controls.select !== null && controls.select !== undefined) this.selectSlot(controls.select);

    const extra = this._dynamicColliders();
    let walk = this._followWalkTarget(dt, controls);
    if (this.fishing.locked) walk = { move: [0, 0], running: false };
    this.player.update(dt, walk.move, walk.running, this.world, extra);
    this._footsteps();
    this._animalCalls(dt);
    this._updateHover(controls);

    if (this.fishing.active && (controls.use || controls.interact)) {
      this.fishing.press(this);
    } else {
      if (controls.use) this._use(controls);
      if (controls.interact) this._interactNearest();
    }
    this.fishing.update(dt, this);
    this.player.fishing = this._fishingPose();
    this._checkStory();
  }

  _fishingPose() {
    const f = this.fishing;
    if (f.state === 'wait' || f.state === 'cast') return 'hold';
    if (f.state === 'bite') return 'bite';
    if (f.state === 'reel') return 'reel';
    if (f.state === 'caught') return 'raise';
    return null;
  }

  _simulate(hours, dt) {
    if (this.weather.rain > 0.5) this.farm.waterAll();
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
    const context = { sunflowers: this.farm.countCrops('sunflower', 2) };
    for (const machine of this.machines) {
      const finished = machine.update(hours, dt, context);
      if (finished.length) {
        this.sound('machine_done', [machine.x, 1, machine.z], { volume: 0.8 });
        this.toast(`${machine.def.name}: ${ITEMS[finished[0]].name.toLowerCase()} pronto!`, 'good');
      }
    }
    if (this.progress.ordersOpen && this.orderTimer > 0) {
      this.orderTimer -= hours;
      if (this.orderTimer <= 0 && this.orders.refresh(this).added) {
        this.toast('Chegou um pedido novo no Mural da Vila.', 'info');
        this.sound('page', null, { volume: 0.7 });
      }
    }
  }

  /** Morning routine: weather, petting, orders, irrigation. Runs once per day at 6:00. */
  _checkDayStart() {
    if (this.clock.hour < DAY_START_HOUR || this.clock.day === this.lastDayStart) return;
    this.lastDayStart = this.clock.day;
    // chapter 7 needs a rainy morning: never more than two dry days in a row
    this.weather.newDay(Math.random, this.progress.chapter === 6 ? 2 : null);
    for (const animal of this.animals) animal.pettedToday = false;
    if (this.upgrades.irrigation && this.farm.waterAll()) this.toast('A irrigação regou a plantação.', 'info');
    if (this.weather.raining) this.toast('Está chovendo: a chuva rega a plantação.', 'info');
    if (this.progress.ordersOpen) {
      const { added } = this.orders.refresh(this);
      if (added) this.toast(`${added > 1 ? `${added} pedidos novos` : 'Pedido novo'} no Mural da Vila.`, 'info');
    }
    const bonus = this.sellBonus();
    if (bonus > 1) this.toast(`${this.sellBonusLabel()}: a caixa paga ${Math.round((bonus - 1) * 100)}% a mais hoje!`, 'good');
  }

  /** Price multiplier of the shipping bin today. */
  sellBonus() {
    const weekday = this.clock.day % 7;
    if (weekday === 0 && this.progress.bloom) return 1.25;
    if (weekday === 6) return 1.1;
    return 1;
  }

  sellBonusLabel() {
    const weekday = this.clock.day % 7;
    if (weekday === 0 && this.progress.bloom) return 'Domingo de festa';
    if (weekday === 6) return 'Sábado de feira';
    return '';
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
      animal.callTimer = (ANIMAL_CALL[animal.type] || 12) * (0.6 + Math.random() * 0.9);
      if (this._distanceToPlayer(animal.pos[0], animal.pos[2]) < 16) {
        this.sound(animal.type, [animal.pos[0], 1, animal.pos[2]], { volume: 0.55, ambient: true });
      }
    }
  }

  _dynamicColliders() {
    const list = this.trees.map((t) => ({ type: 'circle', x: t.x, z: t.z, r: 0.35 }));
    for (const a of this.animals) list.push({ type: 'circle', x: a.pos[0], z: a.pos[2], r: a.def.radius * 0.7 });
    for (const m of this.machines) list.push({ type: 'circle', x: m.x, z: m.z, r: m.passive ? 0.35 : 0.55 });
    return list;
  }

  // ------------------------------------------------------------------
  // hotbar
  // ------------------------------------------------------------------

  get tool() {
    return this.selectedId;
  }

  /** Tools first, then the seeds the farmer carries. */
  hotbar() {
    const tools = TOOLS.filter((t) => t !== 'rod' || this.progress.rod);
    const seeds = Object.keys(ITEMS).filter((id) => ITEMS[id].kind === 'seed' && this.inventory.count(id) > 0);
    let shown = seeds.slice(0, this.seedSlots);
    if (ITEMS[this.selectedId].kind === 'seed' && !shown.includes(this.selectedId)) {
      shown = [...shown.slice(0, this.seedSlots - 1), this.selectedId];
    }
    return tools.concat(shown);
  }

  selectSlot(index) {
    const id = this.hotbar()[index];
    if (id) this.selectItem(id);
  }

  selectItem(id) {
    if (!ITEMS[id] || id === this.selectedId || this.fishing.locked) return;
    if (id === 'rod' && !this.progress.rod) return;
    this.selectedId = id;
    this.sound('select');
  }

  // ------------------------------------------------------------------
  // targeting
  // ------------------------------------------------------------------

  /** Everything the farmer can interact with (buildings, animals, trees, machines). */
  interactables() {
    const list = this.world.interactables.map((it) => ({ ...it, reach: it.radius + 0.6 }));
    for (const it of list) {
      if (it.type === 'house' && !this.canSleep()) it.label = 'Casa (dá para dormir depois das 18:00)';
      if (it.type === 'mailbox') {
        const n = this.progress.unreadLetters().length;
        it.label = n ? `Ler carta nova${n > 1 ? ` (${n})` : ''}` : 'Caixa de correio';
      }
      if (it.type === 'board') {
        it.label = this.progress.ordersOpen ? `Mural da Vila (${this.orders.list.length} pedidos)` : 'Mural da Vila (vazio)';
      }
      if (it.type === 'ipe') it.label = this.progress.bloom ? 'Ipê-amarelo em flor' : 'Ipê-amarelo do avô';
    }
    for (const animal of this.animals) {
      const def = animal.def;
      const prep = def.article === 'o' ? 'no' : 'na';
      let label;
      if (animal.ready) label = `Coletar ${ITEMS[def.product].name.toLowerCase()}`;
      else if (!animal.pettedToday) label = `Fazer carinho ${prep} ${def.name.toLowerCase()}`;
      else label = `${def.name} · amizade ${animal.hearts}/${MAX_LOVE}`;
      list.push({
        type: 'animal', ref: animal, x: animal.pos[0], z: animal.pos[2], height: animal.bubbleHeight * 0.6,
        radius: def.radius + 0.15, reach: def.radius + 1.4, label,
      });
    }
    for (const tree of this.trees) {
      const n = tree.readyCount();
      const fruit = ITEMS[tree.def.fruit].name.toLowerCase();
      list.push({
        type: 'tree', ref: tree, x: tree.x, z: tree.z, height: 1.6, radius: 0.9, reach: 2.2,
        label: n ? `Colher ${n} ${n > 1 ? `${fruit}s` : fruit}` : `${tree.def.name} (frutos crescendo)`,
      });
    }
    for (const machine of this.machines) {
      const ready = machine.readyCount();
      let label;
      if (ready) label = `${machine.def.name}: coletar ${ready}`;
      else if (machine.passive) label = `${machine.def.name} (abelhas trabalhando)`;
      else if (machine.queue.length) label = `${machine.def.name} (${machine.queue.length} na fila)`;
      else label = `Usar ${machine.def.name.toLowerCase()}`;
      list.push({
        type: 'machine', ref: machine, x: machine.x, z: machine.z, height: 0.8,
        radius: machine.passive ? 0.5 : 0.75, reach: machine.passive ? 1.6 : 1.9, label,
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
    this.hover.water = null;
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
      if (!this.hover.object && Math.abs(ray.dir[1]) > 1e-4) {
        // water under the mouse (fishing)
        if (this.tool === 'rod') {
          const tw = (WATER_Y - ray.origin[1]) / ray.dir[1];
          const wx = ray.origin[0] + ray.dir[0] * tw;
          const wz = ray.origin[2] + ray.dir[2] * tw;
          if (tw > 0 && inPond(wx, wz, 0.35)) {
            this.hover.water = { x: wx, z: wz, inReach: Fishing.canReach(this.player.pos, [wx, wz]) };
          }
        }
        // tile under the mouse (ray vs ground plane y = 0)
        const t = -ray.origin[1] / ray.dir[1];
        if (t > 0 && !this.hover.water) {
          const x = ray.origin[0] + ray.dir[0] * t;
          const z = ray.origin[2] + ray.dir[2] * t;
          this.hover.tile = this._tileInfo(Math.floor(x), Math.floor(z));
        }
      }
    }
    if (!this.hover.tile && !this.hover.object && !this.hover.water) {
      // keyboard targeting: the tile right in front of the farmer
      const [fx, fz] = this.player.forward();
      const tile = this._tileInfo(Math.floor(this.player.pos[0] + fx * 0.85), Math.floor(this.player.pos[2] + fz * 0.85));
      if (tile.inField) this.hover.tile = { ...tile, keyboard: true };
    }

    // prompt for the nearest interactable in reach (E key)
    const near = this._nearestInteractable(candidates);
    this.hover.prompt = near ? near.label : null;
    if (!near && this.tool === 'rod' && !this.fishing.active && Fishing.spotAhead(this.player.pos, this.player.forward())) {
      this.hover.prompt = 'Pescar';
    }
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
    if (this.tool === 'rod') {
      this._useRod(controls);
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

  /** Casting: at the water under the mouse / finger, or straight ahead. */
  _useRod(controls) {
    const water = this.hover.water;
    const pos = this.player.pos;
    if (water) {
      const spot = [water.x, water.z];
      if (water.inReach) this.fishing.cast(this, spot);
      else if (this.tapToWalk && controls.rayFromMouse) {
        const [sx, sz] = Fishing.standPoint(pos, spot);
        this._walkTo({ kind: 'cast', x: sx, z: sz, spot });
      } else this._refuse('Chegue mais perto da beira do lago.');
      return;
    }
    const ahead = Fishing.spotAhead(pos, this.player.forward());
    if (ahead) {
      this.fishing.cast(this, ahead);
      return;
    }
    const tile = this.hover.tile;
    if (tile && tile.inField && tile.action === 'harvest' && tile.inReach) {
      this._tileAction(tile);
      return;
    }
    this._refuse(controls.rayFromMouse && !this.tapToWalk
      ? 'Mire na água do lago para pescar.' : 'Vá até a beira do lago e fique de frente para a água.');
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
    } else if (w.kind === 'cast') {
      tx = w.x;
      tz = w.z;
      reach = Fishing.canReach(p, w.spot) && this._distanceToPlayer(w.x, w.z) < 2.2 ? 99 : 0.45;
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
      } else if (w.kind === 'cast') {
        if (this.tool === 'rod' && Fishing.canReach(p, w.spot)) this.fishing.cast(this, w.spot);
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
      if (w.kind === 'cast' && this.tool === 'rod' && Fishing.canReach(p, w.spot)) {
        this.fishing.cast(this, w.spot);
        return { move: [0, 0], running: false };
      }
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
      if (this.inventory.count(tool) === 0) this.toast(`Sem ${ITEMS[tool].name.toLowerCase()}. Compre no mercadinho.`, 'bad');
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
        this.progress.count('till');
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
        this.progress.count('plant');
        this.addXp(1);
        this.sound('plant', [cx, 0, cz]);
        this.particles.emit([cx, 0.15, cz], 6, { color: [0.75, 0.9, 0.4, 1], speed: 0.6, up: 1.5, life: 0.5, size: 0.08 });
        break;
      }
      case 'harvest': {
        const type = this.farm.get(i, j).crop.type;
        const result = this.farm.harvest(i, j);
        if (result) {
          const pos = [cx, 0.8, cz];
          this._gain(result.produce, result.amount, pos);
          this.progress.count('harvest', result.amount);
          this.progress.count(`harvest_${type}`, result.amount);
          this.addXp(harvestXp(result.produce) * result.amount, pos);
          if (result.seed) {
            this.inventory.add(result.seed, 1);
            this.toast(`Sobrou uma ${ITEMS[result.seed].name.toLowerCase()}!`, 'good');
          }
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
      case 'mailbox': {
        const unread = this.progress.unreadLetters();
        if (unread.length) {
          this.progress.markRead(unread[0].id);
          this.sound('letter');
          this.events.push({ type: 'letter', id: unread[0].id });
        } else {
          this.toast('Nenhuma carta nova. Releia as cartas no diário (tecla J).', 'info');
          this.sound('error', null, { volume: 0.4 });
        }
        break;
      }
      case 'board':
        if (this.progress.ordersOpen) {
          this.sound('page');
          this.events.push({ type: 'orders' });
        } else {
          this._refuse('O mural ainda está vazio. A vila vai mandar pedidos em breve.');
        }
        break;
      case 'ipe':
        this._ipeLore();
        break;
      case 'animal':
        this._animalInteract(obj.ref);
        break;
      case 'tree': {
        const tree = obj.ref;
        this.player.startAction('harvest', tree.x, tree.z);
        const result = tree.collect();
        if (result) {
          const pos = [tree.x, 2.0, tree.z];
          this._gain(result.produce, result.amount, pos);
          this.addXp(2 * result.amount, pos);
          this.sound('fruit', [tree.x, 1, tree.z]);
        } else {
          this._refuse('As frutas ainda estão crescendo.');
        }
        break;
      }
      case 'machine':
        this._machineInteract(obj.ref);
        break;
      default:
        break;
    }
  }

  _ipeLore() {
    const ipe = this.world.ipe;
    this.player.startAction('pet', ipe.x, ipe.z);
    let text;
    if (this.progress.bloom) text = 'O ipê do avô está coberto de flores amarelas. Domingo é dia de festa na vila!';
    else if (this.progress.chapter >= 6) text = 'O ipê espera o Dourado voltar. Ele só sobe nas manhãs de chuva.';
    else if (this.progress.chapter >= 3) text = 'Um ipê antigo, sem nenhuma flor. Dizem que foi o mais bonito do vale.';
    else text = 'Um ipê velho e sem folhas. Alguém entalhou um sol no tronco.';
    this.toast(text, 'info');
    this.sound('pet', [ipe.x, 1, ipe.z], { volume: 0.5 });
  }

  _animalInteract(animal) {
    const def = animal.def;
    this.player.startAction('collect', animal.pos[0], animal.pos[2]);
    const voicePos = [animal.pos[0], 1, animal.pos[2]];
    const top = [animal.pos[0], animal.bubbleHeight, animal.pos[2]];
    this.sound(animal.type, voicePos);
    let petted = false;
    if (!animal.pettedToday) {
      animal.pet();
      petted = true;
      this.progress.count('pet');
      this.addXp(3);
      this.sound('pet', voicePos);
      this.particles.emit(top, 6, { color: [1, 0.45, 0.6, 1], speed: 0.4, up: 1.2, gravity: -0.5, life: 1.0, size: 0.14 });
    }
    const product = animal.collect();
    if (product) {
      this._gain(product, 1, top);
      this.progress.count('collect');
      this.addXp(6, top);
      this.sound('collect', voicePos);
    }
    const hours = Math.max(1, Math.ceil(animal.hoursLeft));
    if (petted && !product) {
      this.toast(`${def.name} feliz! Amizade ${animal.hearts}/${MAX_LOVE} · produz em ~${hours}h.`, 'info');
    } else if (!petted && !product) {
      this.toast(`${def.name} já ganhou carinho hoje. Produz de novo em ~${hours}h.`, 'info');
    }
  }

  _machineInteract(machine) {
    this.player.startAction('collect', machine.x, machine.z);
    if (machine.readyCount()) {
      this.machineCollect(machine);
      return;
    }
    if (machine.passive) {
      const h = Math.max(1, Math.ceil(machine.hoursLeft({ sunflowers: this.farm.countCrops('sunflower', 2) })));
      this.toast(`As abelhas estão trabalhando: mel em ~${h}h. Girassóis por perto aceleram!`, 'info');
      this.sound('machine', [machine.x, 1, machine.z], { volume: 0.5 });
      return;
    }
    this.events.push({ type: 'machine', id: machine.id });
  }

  /** Adds items, records them in the album and shows the floating text. */
  _gain(itemId, amount, pos) {
    this.inventory.add(itemId, amount);
    if (this.progress.discover(itemId, amount) && ITEMS[itemId].kind === 'produce') {
      this.toast(`Novo no álbum: ${ITEMS[itemId].name}!`, 'good');
    }
    this.floater(`+${amount} ${ITEMS[itemId].name}`, pos, [1, 0.97, 0.75, 1], itemId);
    this.particles.emit(pos, 10, { color: [1, 0.9, 0.4, 1], speed: 1.2, up: 2.4, gravity: 5, life: 0.7, size: 0.1 });
  }

  // ------------------------------------------------------------------
  // experience, levels and the story
  // ------------------------------------------------------------------

  addXp(amount, pos = null) {
    if (amount <= 0) return;
    if (pos) this.floater(`+${Math.round(amount)} XP`, [pos[0], pos[1] - 0.35, pos[2]], [0.7, 0.9, 1, 1], null);
    const gained = this.progress.addXp(amount);
    for (let k = gained - 1; k >= 0; k--) this._levelUp(this.progress.level - k);
  }

  /** What becomes available at a level (for the level-up banner). */
  unlocksAt(level) {
    const names = [];
    for (const [id, crop] of Object.entries(CROPS)) if (crop.level === level) names.push(ITEMS[`seed_${id}`].name);
    for (const def of Object.values(ANIMALS)) if (def.level === level) names.push(def.name);
    for (const def of Object.values(MACHINES)) if (def.level === level) names.push(def.name);
    for (const up of Object.values(UPGRADES)) if (up.need.slice(1).includes(level)) names.push(up.name);
    return names;
  }

  _levelUp(level) {
    const unlocks = this.unlocksAt(level);
    let subtitle = unlocks.length ? `Novidades no mercadinho: ${unlocks.join(', ')}` : 'O sítio está ficando conhecido no vale!';
    if (level > 8) {
      const prize = 200 * level;
      this.money += prize;
      subtitle = `Prêmio da vila: R$ ${prize}`;
    }
    this.banner(`Nível ${level}!`, subtitle, 'star');
    this.sound('levelup');
    const p = this.player.pos;
    this.particles.emit([p[0], 1.6, p[2]], 26, { color: [0.6, 0.85, 1, 1], speed: 2.2, up: 3.2, life: 1.1 });
  }

  _checkStory() {
    for (const state of this.progress.checkMilestones()) {
      const tier = state.tier + 1;
      const prize = 80 * tier;
      this.money += prize;
      this.addXp(25 * tier);
      this.toast(`Marco alcançado: ${state.milestone.name} ${state.target}! +R$ ${prize}`, 'good');
      this.sound('order', null, { volume: 0.7 });
    }
    if (this.progress.finished || !this.progress.chapterComplete(this)) return;
    if (this.banners.length > 2) return;   // let the previous messages show first
    this._completeChapter();
  }

  _completeChapter() {
    const index = this.progress.chapter;
    const chapter = CHAPTERS[index];
    const reward = chapter.reward;
    const parts = [];
    if (reward.money) {
      this.money += reward.money;
      parts.push(`R$ ${reward.money}`);
    }
    if (reward.rod) {
      this.progress.rod = true;
      parts.push('a vara de pesca do avô');
    }
    if (reward.orders) {
      this.progress.ordersOpen = true;
      this.orders.refresh(this);
      parts.push('o Mural da Vila');
    }
    if (reward.machine) {
      if (this.machines.some((m) => m.id === reward.machine)) {
        // already bought in the shop: the village pays it back
        const price = MACHINES[reward.machine].price;
        this.money += price;
        parts.push(`R$ ${price} (o valor da ${MACHINES[reward.machine].name.toLowerCase()} que você já tinha)`);
      } else {
        this.machines.push(new Machine(reward.machine));
        parts.push(MACHINES[reward.machine].name.toLowerCase());
      }
    }
    if (reward.items) {
      for (const [id, n] of Object.entries(reward.items)) {
        this.inventory.add(id, n);
        parts.push(`${n} ${ITEMS[id].name.toLowerCase()}`);
      }
    }
    if (reward.bloom) {
      this.progress.bloom = true;
      const ipe = this.world.ipe;
      this.particles.emit([ipe.x, 3, ipe.z], 40, { color: [1, 0.85, 0.2, 1], speed: 2.4, up: 2, gravity: 1, life: 2, size: 0.16 });
    }
    if (reward.letter) this.progress.addLetter(reward.letter);
    this.addXp(40 + 30 * index);
    this.progress.startChapter(index + 1);

    this.banner(`Capítulo concluído: ${chapter.title}`, parts.length ? `Recompensa: ${parts.join(', ')}` : 'Muito bem!', 'check');
    const next = this.progress.current;
    if (next) this.banner(`Capítulo ${index + 2}: ${next.title}`, next.summary, 'journal');
    else this.banner('O ipê floresceu!', 'A Festa do Sol voltou. O sítio continua: novos pedidos, peixes e recordes todo dia.', 'ipe');
    if (reward.letter) this.toast('Chegou uma carta da Vó na caixa de correio!', 'good');
    if (reward.rod) this.toast('Escolha a vara na barra de ferramentas e vá até o lago.', 'info');
    this.sound('chapter');
    this.events.push({ type: 'chapter', index });
  }

  /** Short hint for the objective tracker. */
  hint() {
    const p = this.progress;
    if (p.unreadLetters().length) return 'Carta nova na caixa de correio, ao lado da casa.';
    if (p.chapter === 6 && !p.stat('fish_dourado')) {
      if (this.weather.raining && this.clock.hour < 10) return 'Manhã de chuva: corra para o lago procurar o Dourado!';
      if (this.canSleep()) return `O Dourado só sobe em manhãs de chuva. Previsão para amanhã: ${WEATHER[this.weather.tomorrow].name.toLowerCase()}.`;
    }
    if (p.chapter === 2 && this.tool !== 'rod') return 'Escolha a vara de pesca na barra e vá até o lago, a sudoeste da plantação.';
    const ready = this.machines.find((m) => m.readyCount());
    if (ready) return `${ready.def.name}: produtos prontos no galpão.`;
    const deliverable = p.ordersOpen && this.orders.list.find((o) => this.orders.canDeliver(o, this.inventory));
    if (deliverable) return `Dá para entregar o pedido de ${ITEMS[deliverable.item].name.toLowerCase()} no mural.`;
    if (this.canSleep()) return 'Já é tarde: durma em casa para avançar o dia e salvar.';
    return null;
  }

  /** Emits a UI event after some seconds of play (e.g. open a letter after the catch popup). */
  later(event, seconds) {
    this.pending.push({ event, t: seconds });
  }

  banner(title, subtitle, icon) {
    this.banners.push({ title, subtitle, icon, t: 0 });
  }

  // ------------------------------------------------------------------
  // fishing results
  // ------------------------------------------------------------------

  /** Called by the fishing mini-game when something is landed. Returns what the popup shows. */
  landCatch(hooked) {
    const p = this.player.pos;
    const pos = [p[0], 2.3, p[2]];
    if (hooked.kind === 'bottle') {
      this.progress.addLetter(hooked.letter, true);
      this.addXp(10, pos);
      this.later({ type: 'letter', id: hooked.letter }, 1.4);
      return { kind: 'bottle', icon: 'message_bottle', model: 'message_bottle', name: 'Garrafa com bilhete', detail: 'Tem um bilhete antigo dentro!' };
    }
    if (hooked.kind === 'junk') {
      this._gain(hooked.item, 1, pos);
      this.addXp(1);
      return { kind: 'junk', icon: hooked.item, model: hooked.item, name: ITEMS[hooked.item].name, detail: 'Pelo menos o lago ficou mais limpo.' };
    }
    const first = !this.progress.found[hooked.item];
    this._gain(hooked.item, 1, pos);
    const record = this.progress.recordFish(hooked.species, hooked.size);
    this.progress.count('fish');
    this.progress.count(`fish_${hooked.species}`);
    const xp = hooked.species === 'dourado' ? 100 : 5 + 4 * hooked.difficulty;
    this.addXp(xp, pos);
    if (hooked.species === 'dourado') {
      this.banner('O Dourado!', 'O peixe cor de sol da lenda do vale apareceu para você.', 'fish_dourado');
    }
    let detail = `${hooked.size.toFixed(1).replace('.', ',')} cm`;
    if (record) detail += ' · novo recorde!';
    else if (first) detail += ' · primeira vez!';
    return { kind: 'fish', icon: hooked.item, model: hooked.item, name: ITEMS[hooked.item].name, detail, size: hooked.size, record, first };
  }

  // ------------------------------------------------------------------
  // shop, selling, upgrades, machines, orders, sleep
  // ------------------------------------------------------------------

  animalCapacity(building) {
    return UPGRADES[building].levels[this.upgrades[building]];
  }

  animalCount(building) {
    return this.animals.filter((a) => a.def.building === building).length;
  }

  _lockInfo(level) {
    const locked = this.progress.level < level;
    return { locked, lockLevel: level, reason: locked ? `Nível ${level}` : null };
  }

  /** Describes a shop entry for the UI: { name, price, canBuy, reason, detail, locked, ... } */
  shopEntry(id) {
    const money = (price) => (this.money >= price ? null : 'Dinheiro insuficiente');
    if (ITEMS[id] && ITEMS[id].kind === 'seed') {
      const item = ITEMS[id];
      const crop = CROPS[item.crop];
      const hours = crop.hoursPerStage * 4;
      const lock = this._lockInfo(crop.level);
      const reason = lock.reason || money(item.price);
      return {
        id, kind: 'seed', icon: item.icon, name: item.name, price: item.price,
        detail: `Colheita em ${hours}h regadas · vende por R$ ${ITEMS[crop.produce].sell}${crop.regrowStage !== null ? ' · rebrota' : ''}`,
        owned: this.inventory.count(id), canBuy: !reason, reason, locked: lock.locked, lockLevel: lock.lockLevel,
      };
    }
    if (ANIMALS[id]) {
      const def = ANIMALS[id];
      const cap = this.animalCapacity(def.building);
      const count = this.animalCount(def.building);
      const full = count >= cap;
      const lock = this._lockInfo(def.level);
      const reason = lock.reason || (full ? 'Sem espaço: amplie a construção' : money(def.price));
      return {
        id, kind: 'animal', icon: id, name: def.name, price: def.price,
        detail: `${ITEMS[def.product].name} a cada ${def.hours}h · ${def.building === 'coop' ? 'galinheiro' : 'celeiro'} ${count}/${cap}`,
        canBuy: !reason, reason, locked: lock.locked, lockLevel: lock.lockLevel,
      };
    }
    if (MACHINES[id]) {
      const def = MACHINES[id];
      const owned = this.machines.some((m) => m.id === id);
      const lock = this._lockInfo(def.level);
      const reason = owned ? 'Já instalada' : lock.reason || money(def.price);
      let makes;
      if (def.passive) makes = `${ITEMS[def.passive.output].name} a cada ${def.passive.hours}h`;
      else if (def.recipes.length > 2) makes = `${def.recipes.length} receitas`;
      else makes = def.recipes.map((r) => ITEMS[r.output].name).join(', ');
      return {
        id, kind: 'machine', icon: id, name: def.name, price: owned ? 0 : def.price,
        detail: `${def.desc} Faz: ${makes}.`, canBuy: !reason, reason, maxed: owned,
        locked: !owned && lock.locked, lockLevel: lock.lockLevel,
      };
    }
    const up = UPGRADES[id];
    const level = this.upgrades[id];
    const maxed = level >= up.levels.length - 1;
    const price = maxed ? 0 : up.costs[level + 1];
    const need = maxed ? 0 : up.need[level + 1];
    const lock = this._lockInfo(need);
    const reason = maxed ? 'Nível máximo' : lock.reason || money(price);
    return {
      id, kind: 'upgrade', icon: up.icon, name: up.name, price,
      detail: maxed ? `${up.desc} Nível máximo (${up.describe(up.levels[level])}).`
        : `${up.desc} ${up.describe(up.levels[level])} » ${up.describe(up.levels[level + 1])}`,
      canBuy: !reason, reason, maxed, locked: !maxed && lock.locked, lockLevel: need,
    };
  }

  buy(id, quantity = 1) {
    const entry = this.shopEntry(id);
    if (!entry.canBuy) {
      if (entry.reason) this._refuse(entry.locked ? `Libera no nível ${entry.lockLevel}.` : entry.reason, 'bad');
      return false;
    }
    if (entry.kind === 'seed') {
      const n = Math.min(quantity, Math.floor(this.money / entry.price));
      this.money -= entry.price * n;
      this.inventory.add(id, n);
      this.toast(`Comprou ${n}x ${entry.name.toLowerCase()}.`, 'good');
      this.sound('buy');
      if (ITEMS[this.selectedId].kind !== 'seed') this.selectedId = id;
    } else if (entry.kind === 'animal') {
      this.money -= entry.price;
      const animal = new Animal(id);
      this.animals.push(animal);
      animal.joy = 1;
      this.progress.count('buy_animal');
      this.toast(`${entry.name} chegou ao sítio!`, 'good');
      this.sound('buy');
      this.sound(id, null, { volume: 0.8 });
    } else if (entry.kind === 'machine') {
      this.money -= entry.price;
      this.machines.push(new Machine(id));
      this.toast(`${entry.name} instalada no galpão, ao sul do curral!`, 'good');
      this.sound('upgrade');
    } else {
      this.money -= entry.price;
      this.upgrades[id] += 1;
      if (id === 'field') this.applyField();
      if (id === 'orchard') {
        const count = UPGRADES.orchard.levels[this.upgrades.orchard];
        for (let k = this.trees.length; k < count; k++) this.trees.push(new FruitTree(ORCHARD_SPOTS[k]));
      }
      if (id === 'irrigation') this.farm.waterAll();
      this.toast(`Melhoria comprada: ${entry.name}!`, 'good');
      this.sound('upgrade');
      this.particles.emit([this.player.pos[0], 1.5, this.player.pos[2]], 20, { color: [1, 0.85, 0.3, 1], speed: 2, up: 3, life: 1 });
    }
    return true;
  }

  /** Shipping-bin price of one unit today (weekend bonus included). */
  priceOf(id) {
    return Math.round(ITEMS[id].sell * this.sellBonus());
  }

  sell(id, quantity) {
    const have = this.inventory.count(id);
    const n = Math.min(have, quantity);
    if (n <= 0) return 0;
    this.inventory.remove(id, n);
    const value = this.priceOf(id) * n;
    this.money += value;
    this.totalEarned += value;
    this.progress.count('sell', n);
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

  machineById(id) {
    return this.machines.find((m) => m.id === id) || null;
  }

  /** Puts n units of recipe r into a machine, paying with the inventory. */
  machineAdd(machine, r, n) {
    const recipe = machine.def.recipes[r];
    const amount = Math.min(n, machine.room(), this.inventory.count(recipe.input));
    if (amount <= 0) {
      this._refuse(machine.room() <= 0 ? 'A fila está cheia.' : `Sem ${ITEMS[recipe.input].name.toLowerCase()} na mochila.`);
      return 0;
    }
    this.inventory.remove(recipe.input, amount);
    machine.enqueue(r, amount);
    this.sound('machine', [machine.x, 1, machine.z]);
    return amount;
  }

  machineCollect(machine) {
    const out = machine.collect();
    const pos = [machine.x, 1.4, machine.z];
    let total = 0;
    for (const [item, n] of Object.entries(out)) {
      this._gain(item, n, pos);
      total += n;
      if (ITEMS[item].cat === 'artisan') this.progress.count('artisan', n);
    }
    if (total) {
      this.addXp(8 * total, pos);
      this.sound('collect', pos);
    }
    return total;
  }

  deliverOrder(order) {
    if (!this.orders.canDeliver(order, this.inventory)) {
      this._refuse(`Faltam ${order.amount - this.inventory.count(order.item)} ${ITEMS[order.item].name.toLowerCase()}.`, 'bad');
      return false;
    }
    this.inventory.remove(order.item, order.amount);
    this.orders.remove(order);
    this.money += order.reward;
    this.totalEarned += order.reward;
    this.progress.count('orders');
    if (order.special) this.progress.count('special_orders');
    this.addXp(order.xp);
    this.toast(`${order.requester} agradece! +R$ ${order.reward}`, 'good');
    this.sound('order');
    const b = this.world.board;
    this.particles.emit([b.x, 1.6, b.z], 18, { color: [1, 0.85, 0.25, 1], speed: 1.5, up: 3, life: 0.9, size: 0.12 });
    if (this.orders.list.filter((o) => !o.special).length < ORDER_SLOTS) this.orderTimer = ORDER_COOLDOWN_HOURS;
    return true;
  }

  canSleep() {
    const h = this.clock.hour;
    return h >= SLEEP_FROM_HOUR || h < 4;
  }

  /** Skips the night (simulating growth and production) and saves. */
  sleep() {
    this.fishing.reset();
    const hours = this.clock.hoursUntil(DAY_START_HOUR);
    const step = 0.25;
    const context = { sunflowers: this.farm.countCrops('sunflower', 2) };
    for (let t = 0; t < hours; t += step) {
      const h = Math.min(step, hours - t);
      if (this.weather.raining) this.farm.waterAll();
      this.farm.update(h);
      for (const animal of this.animals) animal.advance(h);
      for (const tree of this.trees) tree.update(h, 0);
      for (const machine of this.machines) machine.update(h, 0, context);
    }
    this.clock.advanceHours(hours);
    this.clock.hour = DAY_START_HOUR;
    this._checkDayStart();
    this.weather.update(0, true);
    this.player.pos = [-9.4, 0, -8.6];
    this.player.yaw = 0;
    this.walkTarget = null;
    const saved = this.save();
    const weather = WEATHER[this.weather.today].name.toLowerCase();
    this.toast(saved ? `Bom dia! Dia ${this.clock.day} · ${weather} · jogo salvo.` : `Bom dia! Dia ${this.clock.day} · ${weather}.`, 'good');
  }

  // ------------------------------------------------------------------
  // feedback: toasts, floating texts and banners
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
    this.toasts = this.toasts.filter((t) => t.t < 3.6);
    for (const f of this.floaters) {
      f.t += dt;
      f.pos[1] += dt * 0.9;
    }
    this.floaters = this.floaters.filter((f) => f.t < 1.6);
    if (this.banners.length) {
      this.banners[0].t += dt;
      if (this.banners[0].t > 3.6) this.banners.shift();
    }
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
