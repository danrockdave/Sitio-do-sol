/**
 * Builds the render queues for one frame from the game state:
 * static scenery, the windmill, tilled soil and crops, animals, fruit trees,
 * shed machines, the mailbox, the order board and the ipê, the farmer with
 * the held tool, fishing (bobber, line, ripples, the catch), rain, the
 * tile highlight, billboards and lights.
 */

import { mat4, vec3 } from '../../lib/gl-matrix/index.js';
import { createGroundModel } from './ground.js';
import { pivotRotation, placement } from '../game/animate.js';
import { ITEMS } from '../game/data.js';
import { FRUIT_SLOTS } from '../game/trees.js';
import { ROD_TIP } from '../game/player.js';
import { WATER_Y } from '../game/fishing.js';
import { SHED } from '../game/world.js';

const RAIN_DROPS = 700;
const RAIN_BOX = 26;
const RAIN_HEIGHT = 11;

const IDENTITY = mat4.create();
const WET_TINT = [0.58, 0.5, 0.5];
const LAMP_COLOR = [1.0, 0.72, 0.42];

export class SceneBuilder {
  constructor(gl, assets, world) {
    this.assets = assets;
    this.models = assets.models;
    this.world = world;
    this.ground = createGroundModel(gl);
    this.quality = { decor: 1, forest: 1, fireflies: 40 };
    this._m = mat4.create();
    this.flag = 0;            // mailbox flag angle blend (1 = raised)
    this.roof = 1;            // shed roof visibility (cut away when the farmer is inside)
  }

  build(game, env, queue, overlay, billboards, icons, camera) {
    const t = game.time;
    const models = this.models;
    queue.clear();
    overlay.clear();
    billboards.length = 0;

    queue.add(this.ground, IDENTITY);
    const q = this.quality;
    for (const s of this.world.statics) {
      if (s.decor === 'small' && s.keep > q.decor) continue;
      if (s.decor === 'forest' && s.keep > q.forest) continue;
      queue.add(models[s.key], s.matrix, s.tint);
    }

    this._windmill(queue, t);
    this._bin(queue, game);
    this._field(queue, game, t);
    this._animals(queue, game, t, billboards, icons, camera);
    this._trees(queue, game, t, billboards, icons, camera);
    this._machines(queue, game, t, billboards, icons, camera);
    this._village(queue, game, t, billboards, icons, camera);
    this._player(queue, game, t);
    this._fishing(queue, overlay, game, t);
    this._markers(overlay, game, t);
    game.particles.collect(billboards, t, env.glow, q.fireflies);
    this._rain(billboards, game, env, camera, t);
  }

  _windmill(queue, t) {
    const w = this.world.windmill;
    w.angle = t * 0.9;
    const model = this.models.windmill;
    const matrix = placement(w.x, 0, w.z, (w.yaw * Math.PI) / 180);
    const pose = { blades: pivotRotation(model.pivots.blades, 0, 0, (w.angle * 180) / Math.PI) };
    queue.addPosed(model, matrix, pose);
  }

  _bin(queue, game) {
    const model = this.models.shipping_bin;
    const pose = { lid: pivotRotation(model.pivots.lid, -75 * game.binOpen) };
    queue.addPosed(model, this.world.bin.matrix, pose);
  }

  _field(queue, game, t) {
    const farm = game.farm;
    const soil = this.models.soil_tile;
    for (const tile of farm.tiles.values()) {
      if (!tile.tilled) continue;
      const x = tile.i + 0.5;
      const z = tile.j + 0.5;
      const wet = Math.min(1, tile.wet / 2);
      const tint = [1 + (WET_TINT[0] - 1) * wet, 1 + (WET_TINT[1] - 1) * wet, 1 + (WET_TINT[2] - 1) * wet, 1];
      const squash = tile.crop ? 1 : 1 + Math.sin(tile.pop * Math.PI) * 0.6;
      queue.add(soil, placement(x, 0, z, 0, { scale: [1, squash, 1] }), tint);
      if (!tile.crop) continue;
      const stage = farm.stageOf(tile.crop);
      const model = this.models[`${tile.crop.type}_${stage}`];
      const yaw = ((tile.i * 73856093) ^ (tile.j * 19349663)) % 628 / 100;
      const pop = 1 + Math.sin(tile.pop * Math.PI) * 0.28;
      const ripe = stage === 4 ? 1 + Math.sin(t * 3 + tile.i + tile.j) * 0.02 : 1;
      queue.add(model, placement(x, 0.04, z, yaw, { scale: [pop * ripe, pop / ripe, pop * ripe] }));
    }
  }

  _bubble(billboards, icons, camera, pos, iconId, t) {
    const bob = Math.sin(t * 3 + pos[0]) * 0.06;
    const p = [pos[0], pos[1] + bob, pos[2]];
    const toEye = [camera.eye[0] - p[0], camera.eye[1] - p[1], camera.eye[2] - p[2]];
    const len = Math.hypot(...toEye);
    billboards.push({ pos: p, size: 0.62, color: [1, 1, 1, 0.92], mode: 2 });
    billboards.push({
      pos: [p[0] + (toEye[0] / len) * 0.05, p[1] + (toEye[1] / len) * 0.05, p[2] + (toEye[2] / len) * 0.05],
      size: 0.5, color: [1, 1, 1, 1], mode: 1, uv: icons.uv(iconId),
    });
  }

  _animals(queue, game, t, billboards, icons, camera) {
    for (const animal of game.animals) {
      const model = this.models[animal.type];
      const posed = animal.pose(t, model.pivots);
      queue.addPosed(model, posed.matrix, posed.pose);
      if (animal.ready) {
        this._bubble(billboards, icons, camera, [animal.pos[0], animal.bubbleHeight + 0.25, animal.pos[2]], animal.def.product, t);
      }
    }
  }

  _trees(queue, game, t, billboards, icons, camera) {
    const tree = this.models.fruit_tree;
    for (const ft of game.trees) {
      const wobble = Math.sin(t * 28) * 0.06 * ft.shake;
      const matrix = placement(ft.x, 0, ft.z, ft.x * 0.7, { tiltZ: wobble, tiltX: wobble * 0.5 });
      queue.add(tree, matrix);
      const fruitModel = this.models[ft.type];
      FRUIT_SLOTS.forEach((offset, k) => {
        const g = ft.slots[k].growth;
        if (g < 0.2) return;
        const ripe = g >= 1;
        const s = (0.35 + 0.65 * Math.min(1, g)) * 1.45;
        const m = mat4.clone(matrix);
        mat4.translate(m, m, offset);
        if (ripe) mat4.rotateZ(m, m, Math.sin(t * 2 + k) * 0.08);
        mat4.scale(m, m, [s, s, s]);
        const green = ripe ? 0 : 1 - Math.min(1, (g - 0.2) / 0.8);
        queue.add(fruitModel, m, [1 - 0.45 * green, 1 + 0.25 * green, 1 - 0.6 * green, 1]);
      });
      if (ft.readyCount() > 0) {
        this._bubble(billboards, icons, camera, [ft.x, 3.1, ft.z], ft.def.fruit, t);
      }
    }
  }

  _player(queue, game, t) {
    const model = this.models.farmer;
    const player = game.player;
    const posed = player.pose(t, model.pivots);
    queue.addPosed(model, posed.matrix, posed.pose);
    const tool = game.tool;
    const kind = tool.startsWith('seed_') ? 'seed' : tool;
    if (kind === 'seed' && game.inventory.count(tool) === 0) return;
    const held = player.heldToolMatrix(posed, model.pivots, kind);
    if (held) queue.add(this.models[held.model], held.matrix);
    if (kind === 'rod' && held) {
      const tip = vec3.transformMat4(vec3.create(), ROD_TIP, held.matrix);
      game.fishing.tip = [tip[0], tip[1], tip[2]];
    }
    // the catch, held up over the farmer's head
    const f = game.fishing;
    if (f.state === 'caught' && f.result && this.models[f.result.model]) {
      const lift = Math.min(1, f.t * 3);
      const m = placement(player.pos[0], 1.55 + 0.55 * lift, player.pos[2], t * 1.6, { scale: 1.3 * lift });
      queue.add(this.models[f.result.model], m);
    }
  }

  // ------------------------------------------------------------------
  // shed machines and village props
  // ------------------------------------------------------------------

  _machines(queue, game, t, billboards, icons, camera) {
    for (const m of game.machines) {
      const model = this.models[m.def.model];
      if (!model) continue;
      const yaw = (m.def.yaw * Math.PI) / 180;
      const a = m.anim;
      const shake = m.flash > 0 ? Math.sin(t * 40) * 0.02 * m.flash : 0;
      const matrix = placement(m.x, 0, m.z, yaw, { tiltZ: shake });
      const pose = {};
      const working = a > 0.05;
      if (m.id === 'cheese_press' && model.pivots.wheel) pose.wheel = pivotRotation(model.pivots.wheel, 0, t * 70 * a, 0);
      if (m.id === 'jam_pot' && model.pivots.spoon) pose.spoon = pivotRotation(model.pivots.spoon, 0, t * 120 * a, 0);
      if (m.id === 'loom' && model.pivots.beater) pose.beater = pivotRotation(model.pivots.beater, Math.sin(t * 5) * 14 * a);
      queue.addPosed(model, matrix, pose);
      const world = (x, y, z) => {
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        return [m.x + x * c + z * s, y, m.z - x * s + z * c];
      };
      if (m.id === 'jam_pot' && working) {
        queue.add(this.models.fire, placement(m.x, 0, m.z, t * 0.3, { scale: [1, 0.8 + 0.25 * Math.sin(t * 13), 1] }));
        if (Math.random() < 0.15 * a) game.particles.emit(world(0, 0.85, 0), 1, { color: [1, 1, 1, 0.35], speed: 0.1, up: 0.7, gravity: -0.3, life: 1.6, size: 0.22 });
      }
      if (m.id === 'oven') {
        if (working) {
          const flicker = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.1);
          queue.add(this.models.oven_fire, matrix, [flicker, flicker, flicker, 1]);
          if (Math.random() < 0.12 * a) game.particles.emit(world(0.2, 1.15, -0.25), 1, { color: [0.5, 0.48, 0.46, 0.45], speed: 0.1, up: 0.8, gravity: -0.4, life: 2.2, size: 0.26 });
        }
      }
      if (m.id === 'beehive' && working) {
        // bees: small yellow dots buzzing around the hive
        for (let k = 0; k < 7; k++) {
          const ang = t * (1.4 + k * 0.23) + k * 2.1;
          const r = 0.45 + 0.25 * Math.sin(t * 0.9 + k);
          billboards.push({
            pos: [m.x + Math.cos(ang) * r, 0.75 + 0.35 * Math.sin(t * 2.3 + k * 1.7), m.z + Math.sin(ang) * r],
            size: 0.07, color: [1, 0.85, 0.15, 1], mode: 2,
          });
        }
      }
      const ready = Object.keys(m.done).find((id) => m.done[id] > 0);
      if (ready) this._bubble(billboards, icons, camera, [m.x, m.passive ? 1.75 : 2.15, m.z], ITEMS[ready].icon, t);
    }
  }

  _village(queue, game, t, billboards, icons, camera) {
    const world = this.world;
    // mailbox: the flag rises while a letter waits
    const mb = world.mailbox;
    const box = this.models.mailbox;
    const unread = game.progress.unreadLetters().length > 0;
    this.flag += ((unread ? 1 : 0) - this.flag) * 0.08;
    const mbMatrix = placement(mb.x, 0, mb.z, mb.yaw);
    queue.addPosed(box, mbMatrix, { flag: pivotRotation(box.pivots.flag, -90 * (1 - this.flag)) });
    if (unread) this._bubble(billboards, icons, camera, [mb.x, 2.0, mb.z], 'letter', t);

    // order board: papers pinned while there are orders
    const b = world.board;
    const boardModel = this.models.order_board;
    const bMatrix = placement(b.x, 0, b.z, b.yaw);
    const orders = game.progress.ordersOpen ? game.orders.list : [];
    queue.addParts(boardModel, bMatrix, orders.length ? ['frame', 'papers'] : ['frame']);
    if (orders.some((o) => game.orders.canDeliver(o, game.inventory))) {
      this._bubble(billboards, icons, camera, [b.x, 2.75, b.z], 'check', t);
    }

    // the grandfather's ipê: bare until the end of the story, then in bloom
    const ipe = world.ipe;
    const bloom = game.progress.bloom;
    queue.add(this.models[bloom ? 'ipe_bloom' : 'ipe_bare'], placement(ipe.x, 0, ipe.z, ipe.yaw, { scale: 1.0 }));

    // shed: the roof is cut away while the farmer is close, so the machines stay visible
    const shed = this.models.shed;
    const p = game.player.pos;
    const near = Math.abs(p[0] - SHED.x) < SHED.width / 2 + 2.5 && Math.abs(p[2] - SHED.z) < SHED.depth / 2 + 3;
    this.roof += ((near ? 0 : 1) - this.roof) * 0.12;
    const shedMatrix = placement(SHED.x, 0, SHED.z, 0);
    queue.addParts(shed, shedMatrix, ['frame']);
    if (this.roof > 0.02) {
      // the roof lifts and shrinks around its own centre instead of popping
      const k = this.roof;
      const m = placement(SHED.x, 3 + (1 - k) * 3, SHED.z, 0, { scale: k });
      mat4.translate(m, m, [0, -3, 0]);
      queue.addParts(shed, m, ['roof']);
    }
    if (bloom) {
      // falling petals (deterministic, no state)
      for (let k = 0; k < 24; k++) {
        const seed = k * 12.9898;
        const life = 7 + (k % 5);
        const phase = ((t / life + (Math.sin(seed) * 0.5 + 0.5)) % 1);
        const ang = seed * 3.7;
        const r = 0.6 + (k % 7) * 0.38;
        const drift = phase * 1.6;
        billboards.push({
          pos: [ipe.x + Math.cos(ang) * r + drift, 3.8 * (1 - phase) + 0.05, ipe.z + Math.sin(ang) * r + Math.sin(t * 2 + k) * 0.2],
          size: 0.09, color: [1, 0.82, 0.18, Math.min(1, (1 - phase) * 4)], mode: 2,
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // fishing: line, bobber, ripples on the lake
  // ------------------------------------------------------------------

  _fishing(queue, overlay, game, t) {
    const f = game.fishing;
    for (const r of f.ripples) {
      const k = r.t / 1.6;
      const d = r.size * (0.4 + 1.6 * k);
      overlay.add(this.models.ring_marker, placement(r.x, WATER_Y + 0.03, r.z, 0, { scale: [d, 1, d] }), [0.9, 0.97, 1, r.alpha * (1 - k)]);
    }
    if (!f.bobber || !f.tip) return;
    const b = f.bobber;
    queue.add(this.models.bobber, placement(b[0], b[1], b[2], 0, { scale: 1.6 }));
    // line from the rod tip to the bobber, sagging a little in the middle
    const tip = f.tip;
    const top = [b[0], b[1] + 0.16, b[2]];
    const sag = f.state === 'cast' ? 0 : f.state === 'reel' ? 0.05 : 0.35;
    const mid = [(tip[0] + top[0]) / 2, (tip[1] + top[1]) / 2 - sag, (tip[2] + top[2]) / 2];
    this._segment(queue, tip, mid);
    this._segment(queue, mid, top);
  }

  /** Unit box along +Y stretched from a to b (the fishing line). */
  _segment(queue, a, b) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-4) return;
    const y = [d[0] / len, d[1] / len, d[2] / len];
    const ref = Math.abs(y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const x = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), ref, y));
    const z = vec3.cross(vec3.create(), x, y);
    const m = mat4.fromValues(
      x[0], x[1], x[2], 0,
      d[0], d[1], d[2], 0,
      z[0], z[1], z[2], 0,
      a[0], a[1], a[2], 1,
    );
    queue.add(this.models.fishing_line, m);
  }

  // ------------------------------------------------------------------
  // rain: streaks falling around the camera target, splashes on the ground
  // ------------------------------------------------------------------

  _rain(billboards, game, env, camera, t) {
    const amount = env.rain || 0;
    if (amount < 0.02) return;
    const n = Math.floor(RAIN_DROPS * amount * (this.quality.fireflies >= 30 ? 1 : 0.5));
    const cx = camera.target[0];
    const cz = camera.target[2];
    const half = RAIN_BOX / 2;
    const color = [0.78, 0.85, 0.95, 0.5 + 0.2 * (1 - env.glow)];
    for (let k = 0; k < n; k++) {
      const h1 = fract(Math.sin(k * 12.9898) * 43758.5453);
      const h2 = fract(Math.sin(k * 78.233) * 12345.6789);
      const h3 = fract(Math.sin(k * 39.425) * 24634.6345);
      // wrap the drop grid around the camera so the rain follows the player
      const x = cx + wrap(h1 * RAIN_BOX - cx, RAIN_BOX) - half;
      const z = cz + wrap(h2 * RAIN_BOX - cz, RAIN_BOX) - half;
      const y = RAIN_HEIGHT * (1 - fract(h3 + t * (1.25 + 0.3 * h1)));
      billboards.push({ pos: [x + y * 0.12, y, z + y * 0.05], size: 0.55, color, mode: 3 });
      if (y < 0.6 && h2 > 0.55) {
        billboards.push({ pos: [x, 0.04, z], size: 0.12 + (0.6 - y) * 0.2, color: [0.85, 0.9, 1, 0.35], mode: 0 });
      }
    }
  }

  _markers(overlay, game, t) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 6);
    const water = game.hover.water;
    if (water && !game.fishing.active) {
      const color = water.inReach ? [1, 1, 1, 0.85 * pulse] : [1, 0.78, 0.35, 0.6];
      overlay.add(this.models.ring_marker, placement(water.x, WATER_Y + 0.04, water.z, 0, { scale: [0.9, 1, 0.9] }), color);
    }
    const tile = game.hover.tile;
    if (tile && (tile.inField || tile.action)) {
      let color;
      if (tile.action && tile.inReach) color = [1, 1, 1, 0.9 * pulse];
      else if (tile.action) color = [1, 0.78, 0.35, 0.7];
      else color = [1, 1, 1, 0.28];
      const water = tile.action === 'water' && game.upgrades.can > 0;
      const r = water ? 1 : 0;
      for (let di = -r; di <= r; di++) {
        for (let dj = -r; dj <= r; dj++) {
          if (r && !game.farm.inField(tile.i + di, tile.j + dj)) continue;
          overlay.add(this.models.tile_marker, placement(tile.i + di + 0.5, 0.07, tile.j + dj + 0.5, 0), color);
        }
      }
    }
    // pending tap-to-walk target (touch devices)
    const w = game.walkTarget;
    if (w && w.kind === 'tile') {
      overlay.add(this.models.tile_marker, placement(w.i + 0.5, 0.07, w.j + 0.5, 0), [1, 0.86, 0.35, 0.9 * pulse]);
    } else if (w && w.current) {
      const d = (w.current.radius + 0.35) * 2;
      overlay.add(this.models.ring_marker, placement(w.current.x, 0.05, w.current.z, 0, { scale: [d, 1, d] }), [1, 0.86, 0.35, 0.9 * pulse]);
    }
    const obj = game.hover.object;
    if (obj) {
      const color = obj.inReach ? [1, 0.95, 0.6, 0.9 * pulse] : [1, 0.78, 0.35, 0.6];
      const d = (obj.radius + 0.35) * 2;
      overlay.add(this.models.ring_marker, placement(obj.x, 0.05, obj.z, 0, { scale: [d, 1, d] }), color);
    }
  }

  /** Lantern lights near the camera plus the farmer's lamp at night. */
  pointLights(game, env, camera) {
    if (env.glow < 0.05) return [];
    const lights = [];
    const p = game.player;
    const [fx, fz] = p.forward();
    lights.push({
      pos: [p.pos[0] + fx * 0.5, 1.35, p.pos[2] + fz * 0.5],
      color: [1.0 * env.glow * 1.3, 0.82 * env.glow * 1.3, 0.55 * env.glow * 1.3],
      range: 5.5,
    });
    const target = camera.target;
    const lamps = this.world.lamps
      .map((l) => ({ l, d: Math.hypot(l.pos[0] - target[0], l.pos[2] - target[2]) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 7);
    for (const { l } of lamps) {
      const flicker = 0.92 + 0.08 * Math.sin(game.time * 13 + l.pos[0] * 3) * Math.sin(game.time * 7.3 + l.pos[2]);
      const k = env.glow * 1.6 * flicker;
      lights.push({ pos: l.pos, color: [LAMP_COLOR[0] * k, LAMP_COLOR[1] * k, LAMP_COLOR[2] * k], range: 7.5 });
    }
    // fire of the clay oven
    const oven = game.machines.find((m) => m.id === 'oven' && m.anim > 0.05);
    if (oven && Math.hypot(oven.x - target[0], oven.z - target[2]) < 18) {
      const k = env.glow * 1.8 * oven.anim * (0.85 + 0.15 * Math.sin(game.time * 17));
      lights.splice(1, 0, { pos: [oven.x, 0.8, oven.z + 0.8], color: [1.0 * k, 0.5 * k, 0.2 * k], range: 4.5 });
    }
    return lights;
  }
}

function fract(x) {
  return x - Math.floor(x);
}

function wrap(v, size) {
  return ((v % size) + size) % size;
}

export function produceName(id) {
  return ITEMS[id] ? ITEMS[id].name : id;
}
