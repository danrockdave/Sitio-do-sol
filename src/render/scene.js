/**
 * Builds the render queues for one frame from the game state:
 * static scenery, the windmill, tilled soil and crops, animals, fruit trees,
 * the farmer with the held tool, the tile highlight, billboards and lights.
 */

import { mat4 } from '../../lib/gl-matrix/index.js';
import { createGroundModel } from './ground.js';
import { pivotRotation, placement } from '../game/animate.js';
import { ITEMS } from '../game/data.js';
import { FRUIT_SLOTS } from '../game/trees.js';

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
    this._player(queue, game, t);
    this._markers(overlay, game, t);
    game.particles.collect(billboards, t, env.glow, q.fireflies);
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
  }

  _markers(overlay, game, t) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 6);
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
    return lights;
  }
}

export function produceName(id) {
  return ITEMS[id] ? ITEMS[id].name : id;
}
