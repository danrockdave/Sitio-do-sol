/**
 * Static farm layout, built by hand in code: buildings, fences, roads,
 * trees, lamps and decorations, plus the collision shapes and the ground
 * "splat map" that blends grass and dirt in the ground shader.
 *
 * Coordinates: X to the east, Z to the south, 1 unit = 1 farm tile.
 */

import { mat4 } from '../../lib/gl-matrix/index.js';
import { createRandom } from './random.js';

export const FIELD_CENTER = [0, 4];
export const FIELD_MAX = 12;

const SPLAT_RES = 4;               // texels per world unit
const SPLAT_MIN = -40;
const SPLAT_SIZE = 80;

export const PENS = {
  coop: { minX: -21, maxX: -12, minZ: -0.8, maxZ: 7.2, gate: { side: 'east', from: 2, to: 4 } },
  barn: { minX: 10.5, maxX: 21.5, minZ: -1.5, maxZ: 9.5, gate: { side: 'west', from: 3, to: 5 } },
};

export const ORCHARD_SPOTS = [
  { x: -2, z: -12.5, type: 'apple' },
  { x: 2.5, z: -13.2, type: 'orange' },
  { x: 6.5, z: -12.4, type: 'apple' },
  { x: -4.5, z: -16.2, type: 'orange' },
];

export function makeMatrix(x, y, z, yawDeg = 0, scale = 1) {
  const m = mat4.create();
  mat4.translate(m, m, [x, y, z]);
  if (yawDeg) mat4.rotateY(m, m, (yawDeg * Math.PI) / 180);
  if (scale !== 1) mat4.scale(m, m, typeof scale === 'number' ? [scale, scale, scale] : scale);
  return m;
}

export class World {
  constructor() {
    this.statics = [];        // { key, matrix, tint }
    this.colliders = [];      // { type: 'box' | 'circle', ... }
    this.lamps = [];          // { pos: [x, y, z] } lantern light positions
    this.interactables = [];  // { type, x, z, radius, height, label }
    this.windmill = null;
    this.bin = null;
    this.rng = createRandom(2026);
    this.keepRng = createRandom(99);   // separate stream: quality culling never changes the layout
    this.splatWidth = SPLAT_SIZE * SPLAT_RES;
    this.splat = new Uint8Array(this.splatWidth * this.splatWidth);
    this.splatRect = [SPLAT_MIN, SPLAT_MIN, SPLAT_SIZE, SPLAT_SIZE];
    this.splatNoise = this._makeNoise();
    this.fieldSize = 6;
    this._build();
  }

  // ------------------------------------------------------------------
  // layout
  // ------------------------------------------------------------------

  _build() {
    this._buildings();
    this._fences();
    this._roads();
    this._trees();
    this._decorations();
  }

  place(key, x, z, yaw = 0, scale = 1, y = 0, tint) {
    const item = { key, matrix: makeMatrix(x, y, z, yaw, scale), tint, x, z, decor: null, keep: this.keepRng.next() };
    this.statics.push(item);
    return item;
  }

  box(minX, minZ, maxX, maxZ) {
    this.colliders.push({ type: 'box', minX, minZ, maxX, maxZ });
  }

  circle(x, z, r) {
    this.colliders.push({ type: 'circle', x, z, r });
  }

  _buildings() {
    // farmhouse (door faces south)
    this.place('house', -10, -12);
    this.box(-12.3, -13.9, -7.7, -10.1);
    this.circle(-10.4, -9.38, 0.15);
    this.circle(-8.4, -9.38, 0.15);
    this.interactables.push({ type: 'house', x: -9.4, z: -9.6, radius: 1.5, height: 1.8, label: 'Dormir até amanhã' });

    // barn and coop
    this.place('barn', 16, -4.2);
    this.box(13.4, -6.3, 18.6, -2.1);
    this.place('coop', -16.5, -2.4);
    this.box(-17.8, -3.5, -15.2, -1.3);

    // market stall (shop) and shipping bin
    this.place('shop', 12, -12);
    this.box(10.4, -12.8, 13.6, -11.2);
    this.interactables.push({ type: 'shop', x: 12, z: -10.6, radius: 1.8, height: 1.6, label: 'Abrir a loja' });

    this.bin = this.place('shipping_bin', 7.6, -2.6, -15);
    this.box(7.0, -3.05, 8.2, -2.15);
    this.interactables.push({ type: 'bin', x: 7.6, z: -2.2, radius: 1.5, height: 0.8, label: 'Vender produtos' });

    // windmill with animated blades
    this.windmill = { x: 19, z: -15, yaw: -25, angle: 0 };
    this.box(18.2, -15.8, 19.8, -14.2);

    // pond (animated water surface) with reeds and stones around it
    this.place('pond_bank', -15.5, 12.5);
    this.place('pond_water', -15.5, 12.5);
    this.circle(-15.5, 12.5, 3.1);
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + this.rng.range(-0.1, 0.1);
      const r = 3.0 + 0.35 * Math.sin(3 * a + 0.5) + 0.22 * Math.cos(5 * a) + this.rng.range(0.25, 0.6);
      const x = -15.5 + Math.cos(a) * r;
      const z = 12.5 - Math.sin(a) * r;
      if (k % 3 === 0) this.place(this.rng.pick(['rock', 'rock_b']), x, z, this.rng.range(0, 360), this.rng.range(0.5, 0.8));
      else this.place('tall_grass', x, z, this.rng.range(0, 360), this.rng.range(1.0, 1.5));
    }

    this.place('well', -4.5, -7.6);
    this.circle(-4.5, -7.6, 0.75);
    this.place('scarecrow', -7.3, 4.2, 15);
    this.circle(-7.3, 4.2, 0.25);

    // props
    this.place('trough', 20.3, 5.5, 90);
    this.box(19.9, 4.8, 20.7, 6.2);
    for (const [x, z, yaw] of [[12.2, 8.3, 10], [13.3, 8.6, -20], [19.8, 8.4, 70]]) {
      this.place('hay_bale', x, z, yaw);
      this.circle(x, z, 0.5);
    }
    for (const [key, x, z, yaw] of [['barrel', 19.4, -2.1, 0], ['crate', 12.9, -1.0, 15], ['crate', 9.5, -11.4, -10],
      ['barrel', 14.4, -11.6, 0], ['crate', -14.6, -1.1, 30], ['barrel', -7.2, -13.4, 0], ['crate', -6.9, -12.4, 40]]) {
      this.place(key, x, z, yaw);
      this.circle(x, z, 0.42);
    }

    // lamps (lantern light position = post + rotated arm offset)
    const lamps = [[-7.6, -8.6, 0], [5.0, -7.9, 180], [9.4, 1.6, 180], [-11.2, 1.2, 0], [10.2, -9.6, 0],
      [-1.3, -8.0, 90], [1.6, 11.0, 0]];
    for (const [x, z, yaw] of lamps) {
      this.place('lamp_post', x, z, yaw);
      this.circle(x, z, 0.15);
      const a = (yaw * Math.PI) / 180;
      this.lamps.push({ pos: [x + Math.cos(a) * 0.42, 1.64, z - Math.sin(a) * 0.42] });
    }
  }

  fenceLine(x0, z0, x1, z1, gaps = []) {
    const horizontal = z0 === z1;
    const length = horizontal ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const step = Math.sign(horizontal ? x1 - x0 : z1 - z0);
    for (let i = 0; i < Math.round(length); i++) {
      const t = i + 0.5;
      const along = (horizontal ? x0 : z0) + step * t;
      if (gaps.some(([a, b]) => along > Math.min(a, b) && along < Math.max(a, b))) continue;
      if (horizontal) this.place('fence', along, z0, 0);
      else this.place('fence', x0, along, 90);
    }
    // collision follows the same segments, split at the gaps
    let start = horizontal ? Math.min(x0, x1) : Math.min(z0, z1);
    const end = horizontal ? Math.max(x0, x1) : Math.max(z0, z1);
    const sorted = [...gaps].map(([a, b]) => [Math.min(a, b), Math.max(a, b)]).sort((a, b) => a[0] - b[0]);
    const addSegment = (a, b) => {
      if (b - a < 0.05) return;
      if (horizontal) this.box(a, z0 - 0.1, b, z0 + 0.1);
      else this.box(x0 - 0.1, a, x0 + 0.1, b);
    };
    for (const [a, b] of sorted) {
      addSegment(start, a);
      start = b;
    }
    addSegment(start, end);
  }

  _fences() {
    const gate = (pen) => [[pen.gate.from, pen.gate.to]];
    const c = PENS.coop;
    this.fenceLine(c.minX, c.minZ, c.maxX, c.minZ, [[-17.9, -15.1]]);
    this.fenceLine(c.minX, c.maxZ, c.maxX, c.maxZ);
    this.fenceLine(c.minX, c.minZ, c.minX, c.maxZ);
    this.fenceLine(c.maxX, c.minZ, c.maxX, c.maxZ, gate(c));
    const b = PENS.barn;
    this.fenceLine(b.minX, b.minZ, b.maxX, b.minZ, [[13.2, 18.8]]);
    this.fenceLine(b.minX, b.maxZ, b.maxX, b.maxZ);
    this.fenceLine(b.minX, b.minZ, b.minX, b.maxZ, gate(b));
    this.fenceLine(b.maxX, b.minZ, b.maxX, b.maxZ);

    // farm boundary with an opening for the southern road
    this.fenceLine(-24, -20, 24, -20);
    this.fenceLine(-24, 18, 24, 18, [[-1.6, 1.6]]);
    this.fenceLine(-24, -20, -24, 18);
    this.fenceLine(24, -20, 24, 18);
  }

  _roads() {
    const road = (x0, z0, x1, z1, w = 1.1, s = 1.0) => this.paintSegment(x0, z0, x1, z1, w, s);
    road(-23, -6.6, 23, -6.6, 1.15);
    road(-9.4, -9.8, -9.4, -6.6, 0.8);
    road(12, -10.6, 12, -6.6, 0.9);
    road(9.4, -6.6, 9.4, 4, 0.85);
    road(9.4, 4, 10.6, 4, 0.75);
    road(-11.2, -6.6, -11.2, 3, 0.85);
    road(-11.2, 3, -12.2, 3, 0.75);
    road(0, -6.6, 0, -2.6, 0.8);
    road(7.6, -6.6, 7.6, -3.2, 0.7);
    road(0, 10.5, 0, 22, 1.0);
    road(16, -6.6, 18.5, -14, 0.7);
    road(-4.5, -6.6, -4.5, -7.6, 0.6);
    road(-11.2, 3, -11.2, 8.6, 0.6);
    road(-11.2, 8.6, -13.0, 10.0, 0.6);
    this.paintCircle(-4.5, -7.6, 1.5, 0.9);
    this.paintCircle(19, -15, 2.0, 0.9);
    this.paintCircle(12, -11, 2.2, 0.9);
    this.paintCircle(-9.4, -9.4, 1.4, 0.9);
    // pen yards: patchy trampled dirt
    for (const pen of Object.values(PENS)) {
      this.paintRect(pen.minX + 0.3, pen.minZ + 0.3, pen.maxX - 0.3, pen.maxZ - 0.3, 0.75, 1.2);
    }
    // the area in front of the barn door is bare earth
    this.paintCircle(16, -1.2, 2.4, 1.0);
    this.paintFieldArea(this.fieldSize);
  }

  /** Marks the unlocked planting area with lightly worked soil. */
  paintFieldArea(size) {
    this.fieldSize = size;
    const half = size / 2;
    this.paintRect(FIELD_CENTER[0] - half - 0.25, FIELD_CENTER[1] - half - 0.25,
      FIELD_CENTER[0] + half + 0.25, FIELD_CENTER[1] + half + 0.25, 0.55, 0.35);
  }

  _trees() {
    const rng = this.rng;
    const kinds = ['tree_round', 'tree_round_b', 'tree_pine', 'tree_autumn', 'tree_round', 'tree_pine'];
    // forest ring outside the boundary fence
    for (let i = 0; i < 230; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const ring = rng.range(0, 1);
      const rx = 27 + ring * 13;
      const rz = 23 + ring * 13;
      const x = Math.cos(angle) * rx * rng.range(0.98, 1.05);
      const z = Math.sin(angle) * rz * rng.range(0.98, 1.05);
      if (Math.abs(x) < 3 && z > 18) continue;            // keep the road clear
      if (Math.abs(x) < 24.8 && z > -20.8 && z < 18.8) continue;
      this.place(rng.pick(kinds), x, z, rng.range(0, 360), rng.range(0.85, 1.3)).decor = 'forest';
    }
    // a few trees inside the farm
    const inside = [[-21.5, -17.5], [-18.5, -18], [21.5, 15.5], [-21.5, 15.5], [-19, 16.2], [22, -18],
      [6, 15.5], [-6.5, 15.8], [-22, -9], [22.2, 12.5], [-14.5, -16.5], [9, -17.5]];
    for (const [x, z] of inside) {
      this.place(rng.pick(['tree_round', 'tree_round_b', 'tree_autumn']), x, z, rng.range(0, 360), rng.range(0.9, 1.15));
      this.circle(x, z, 0.45);
    }
  }

  isBlockedForDecor(x, z) {
    if (x > -6.8 && x < 6.8 && z > -2.8 && z < 10.8) return true;                 // field
    if (Math.abs(z + 6.6) < 1.8) return true;                                       // main road
    for (const pen of Object.values(PENS)) {
      if (x > pen.minX - 0.6 && x < pen.maxX + 0.6 && z > pen.minZ - 0.6 && z < pen.maxZ + 0.6) return true;
    }
    for (const c of this.colliders) {
      if (c.type === 'box' && x > c.minX - 0.8 && x < c.maxX + 0.8 && z > c.minZ - 0.8 && z < c.maxZ + 0.8) return true;
      if (c.type === 'circle' && Math.hypot(x - c.x, z - c.z) < c.r + 0.7) return true;
    }
    if (this.dirtAt(x, z) > 0.35) return true;
    for (const spot of ORCHARD_SPOTS) if (Math.hypot(x - spot.x, z - spot.z) < 1.4) return true;
    return false;
  }

  _decorations() {
    const rng = this.rng;
    // bushes and flowers around the house
    for (const [x, z] of [[-12.9, -11], [-12.8, -12.8], [-7.1, -11.2], [-13, -9.3]]) {
      this.place('bush', x, z, rng.range(0, 360), rng.range(0.8, 1.1));
      this.circle(x, z, 0.5);
    }
    const flowers = ['flower_pink', 'flower_yellow', 'flower_blue', 'flower_white'];
    for (let i = 0; i < 14; i++) {
      this.place(rng.pick(flowers), -12.2 + i * 0.32, -9.6 + rng.range(-0.1, 0.25), rng.range(0, 360), 0.9);
    }
    // flower beds along the field and the road
    for (let i = 0; i < 26; i++) {
      const x = -6 + i * 0.5;
      if (Math.abs(x) < 1.2) continue;
      this.place(flowers[(i >> 2) % 4], x, -3.45 + rng.range(-0.1, 0.1), rng.range(0, 360), 0.85);
    }
    // scattered rocks, flowers, tall grass and grass tufts
    let placed = 0;
    for (let tries = 0; tries < 6000 && placed < 900; tries++) {
      const x = rng.range(-23.4, 23.4);
      const z = rng.range(-19.4, 17.4);
      if (this.isBlockedForDecor(x, z)) continue;
      const roll = rng.next();
      if (roll < 0.035) {
        this.place(rng.pick(['rock', 'rock_b']), x, z, rng.range(0, 360), rng.range(0.6, 1.2));
        this.circle(x, z, 0.3);
      } else if (roll < 0.11) {
        this.place(rng.pick(flowers), x, z, rng.range(0, 360), rng.range(0.8, 1.1)).decor = 'small';
      } else if (roll < 0.2) {
        this.place('tall_grass', x, z, rng.range(0, 360), rng.range(0.8, 1.3)).decor = 'small';
      } else {
        this.place('grass_tuft', x, z, rng.range(0, 360), rng.range(0.8, 1.4)).decor = 'small';
      }
      placed++;
    }
    // tall grass along the inside of the boundary fence
    for (let i = 0; i < 160; i++) {
      const side = rng.int(0, 3);
      const t = rng.range(-1, 1);
      const x = side === 0 ? -23.3 : side === 1 ? 23.3 : t * 23;
      const z = side === 2 ? -19.3 : side === 3 ? 17.3 : t * 18 - 1;
      if (side === 3 && Math.abs(x) < 2.5) continue;
      this.place(rng.pick(['tall_grass', 'grass_tuft', 'tall_grass']), x + rng.range(-0.4, 0.4), z + rng.range(-0.4, 0.4),
        rng.range(0, 360), rng.range(0.9, 1.5)).decor = 'small';
    }
  }

  // ------------------------------------------------------------------
  // ground splat map (R channel = dirt amount)
  // ------------------------------------------------------------------

  _makeNoise() {
    const rng = createRandom(77);
    const n = 64;
    const grid = new Float32Array(n * n).map(() => rng.next());
    return (x, z) => {
      const fx = x * 0.9;
      const fz = z * 0.9;
      const ix = Math.floor(fx);
      const iz = Math.floor(fz);
      const tx = fx - ix;
      const tz = fz - iz;
      const sx = tx * tx * (3 - 2 * tx);
      const sz = tz * tz * (3 - 2 * tz);
      const g = (a, b) => grid[((a % n) + n) % n + (((b % n) + n) % n) * n];
      const top = g(ix, iz) + (g(ix + 1, iz) - g(ix, iz)) * sx;
      const bottom = g(ix, iz + 1) + (g(ix + 1, iz + 1) - g(ix, iz + 1)) * sx;
      return top + (bottom - top) * sz;
    };
  }

  _paint(minX, minZ, maxX, maxZ, valueAt) {
    const res = SPLAT_RES;
    const w = this.splatWidth;
    const i0 = Math.max(0, Math.floor((minX - SPLAT_MIN) * res));
    const i1 = Math.min(w - 1, Math.ceil((maxX - SPLAT_MIN) * res));
    const j0 = Math.max(0, Math.floor((minZ - SPLAT_MIN) * res));
    const j1 = Math.min(w - 1, Math.ceil((maxZ - SPLAT_MIN) * res));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = SPLAT_MIN + (i + 0.5) / res;
        const z = SPLAT_MIN + (j + 0.5) / res;
        const v = valueAt(x, z);
        if (v <= 0) continue;
        const idx = i + j * w;
        this.splat[idx] = Math.max(this.splat[idx], Math.min(255, Math.round(v * 255)));
      }
    }
  }

  paintSegment(x0, z0, x1, z1, halfWidth, strength = 1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len2 = dx * dx + dz * dz || 1;
    const pad = halfWidth + 1;
    this._paint(Math.min(x0, x1) - pad, Math.min(z0, z1) - pad, Math.max(x0, x1) + pad, Math.max(z0, z1) + pad,
      (x, z) => {
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / len2));
        const d = Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)) + (this.splatNoise(x, z) - 0.5) * 0.7;
        return strength * (1 - smoothstep(halfWidth - 0.35, halfWidth + 0.35, d));
      });
  }

  paintCircle(cx, cz, r, strength = 1) {
    this._paint(cx - r - 1, cz - r - 1, cx + r + 1, cz + r + 1, (x, z) => {
      const d = Math.hypot(x - cx, z - cz) + (this.splatNoise(x, z) - 0.5) * 0.8;
      return strength * (1 - smoothstep(r - 0.4, r + 0.4, d));
    });
  }

  paintRect(x0, z0, x1, z1, strength, feather) {
    this._paint(x0 - feather, z0 - feather, x1 + feather, z1 + feather, (x, z) => {
      const dx = Math.max(x0 - x, 0, x - x1);
      const dz = Math.max(z0 - z, 0, z - z1);
      const d = Math.hypot(dx, dz);
      const patchy = 0.75 + 0.5 * this.splatNoise(x * 1.7, z * 1.7);
      return strength * Math.min(1, patchy) * (1 - smoothstep(0, feather, d));
    });
  }

  dirtAt(x, z) {
    const i = Math.floor((x - SPLAT_MIN) * SPLAT_RES);
    const j = Math.floor((z - SPLAT_MIN) * SPLAT_RES);
    if (i < 0 || j < 0 || i >= this.splatWidth || j >= this.splatWidth) return 0;
    return this.splat[i + j * this.splatWidth] / 255;
  }

  splatImage() {
    return { width: this.splatWidth, height: this.splatWidth, channels: 1, data: this.splat };
  }

  // ------------------------------------------------------------------
  // collision
  // ------------------------------------------------------------------

  /** Pushes a circle (pos[0], pos[2], radius) out of every collider. */
  resolveCircle(pos, radius, extra = []) {
    const colliders = extra.length ? this.colliders.concat(extra) : this.colliders;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of colliders) {
        if (c.type === 'box') {
          const cx = Math.max(c.minX, Math.min(pos[0], c.maxX));
          const cz = Math.max(c.minZ, Math.min(pos[2], c.maxZ));
          const dx = pos[0] - cx;
          const dz = pos[2] - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= radius * radius) continue;
          if (d2 > 1e-10) {
            const d = Math.sqrt(d2);
            pos[0] += (dx / d) * (radius - d);
            pos[2] += (dz / d) * (radius - d);
          } else {
            // centre inside the box: leave through the nearest face
            const exits = [pos[0] - c.minX, c.maxX - pos[0], pos[2] - c.minZ, c.maxZ - pos[2]];
            const k = exits.indexOf(Math.min(...exits));
            if (k === 0) pos[0] = c.minX - radius;
            else if (k === 1) pos[0] = c.maxX + radius;
            else if (k === 2) pos[2] = c.minZ - radius;
            else pos[2] = c.maxZ + radius;
          }
        } else {
          const dx = pos[0] - c.x;
          const dz = pos[2] - c.z;
          const min = radius + c.r;
          const d2 = dx * dx + dz * dz;
          if (d2 >= min * min || d2 < 1e-10) continue;
          const d = Math.sqrt(d2);
          pos[0] += (dx / d) * (min - d);
          pos[2] += (dz / d) * (min - d);
        }
      }
    }
    // farm boundary
    pos[0] = Math.max(-23.6, Math.min(23.6, pos[0]));
    pos[2] = Math.max(-19.6, Math.min(pos[2], Math.abs(pos[0]) < 1.6 ? 21 : 17.6));
  }
}

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
