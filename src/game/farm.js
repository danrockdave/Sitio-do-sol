/**
 * Planting grid. Tile (i, j) covers world x in [i, i+1) and z in [j, j+1).
 *
 * Tile state:
 *   tilled   prepared with the hoe
 *   wet      hours of moisture left (crops only grow while wet)
 *   crop     { type, growth (hours), justGrew }
 */

import { CROPS, CROP_STAGES, WET_HOURS } from './data.js';
import { FIELD_CENTER } from './world.js';

export class Farm {
  constructor() {
    this.size = 6;
    this.tiles = new Map();
  }

  key(i, j) {
    return `${i},${j}`;
  }

  bounds() {
    const half = this.size / 2;
    return {
      i0: FIELD_CENTER[0] - half,
      i1: FIELD_CENTER[0] + half,
      j0: FIELD_CENTER[1] - half,
      j1: FIELD_CENTER[1] + half,
    };
  }

  inField(i, j) {
    const b = this.bounds();
    return i >= b.i0 && i < b.i1 && j >= b.j0 && j < b.j1;
  }

  get(i, j) {
    return this.tiles.get(this.key(i, j));
  }

  ensure(i, j) {
    let tile = this.get(i, j);
    if (!tile) {
      tile = { i, j, tilled: false, wet: 0, crop: null, pop: 0 };
      this.tiles.set(this.key(i, j), tile);
    }
    return tile;
  }

  stageOf(crop) {
    const def = CROPS[crop.type];
    return Math.min(CROP_STAGES - 1, Math.floor(crop.growth / def.hoursPerStage));
  }

  isRipe(crop) {
    return this.stageOf(crop) === CROP_STAGES - 1;
  }

  /** What the given tool would do on this tile (used for the cursor colour and the action). */
  actionFor(tool, i, j, seedCount) {
    if (!this.inField(i, j)) return null;
    const tile = this.get(i, j);
    if (tool === 'hoe') {
      if (!tile || !tile.tilled) return 'till';
      if (tile.crop && !this.isRipe(tile.crop)) return 'clear';
      return null;
    }
    if (tool === 'watering_can') return tile && tile.tilled ? 'water' : null;
    if (tool === 'basket') return tile && tile.crop && this.isRipe(tile.crop) ? 'harvest' : null;
    if (tool && tool.startsWith('seed_')) {
      return tile && tile.tilled && !tile.crop && seedCount > 0 ? 'plant' : null;
    }
    return null;
  }

  till(i, j) {
    const tile = this.ensure(i, j);
    tile.tilled = true;
    tile.crop = null;
    tile.pop = 1;
  }

  clear(i, j) {
    const tile = this.get(i, j);
    if (tile) tile.crop = null;
  }

  water(i, j) {
    const tile = this.get(i, j);
    if (!tile || !tile.tilled) return false;
    tile.wet = WET_HOURS;
    return true;
  }

  plant(i, j, type) {
    const tile = this.get(i, j);
    if (!tile || !tile.tilled || tile.crop) return false;
    tile.crop = { type, growth: 0 };
    tile.pop = 1;
    return true;
  }

  /** Returns { produce, amount } or null. */
  harvest(i, j, random = Math.random) {
    const tile = this.get(i, j);
    if (!tile || !tile.crop || !this.isRipe(tile.crop)) return null;
    const def = CROPS[tile.crop.type];
    const amount = def.yield[0] + Math.floor(random() * (def.yield[1] - def.yield[0] + 1));
    if (def.regrowStage !== null) {
      tile.crop.growth = def.regrowStage * def.hoursPerStage;
    } else {
      tile.crop = null;
    }
    tile.pop = 1;
    return { produce: def.produce, amount };
  }

  /** Advances growth and drying. Returns tiles whose crop reached a new stage. */
  update(hours) {
    const grown = [];
    for (const tile of this.tiles.values()) {
      if (tile.crop && tile.wet > 0) {
        const before = this.stageOf(tile.crop);
        const wetHours = Math.min(hours, tile.wet);
        tile.crop.growth += wetHours;
        const maxGrowth = (CROP_STAGES - 1) * CROPS[tile.crop.type].hoursPerStage;
        tile.crop.growth = Math.min(tile.crop.growth, maxGrowth);
        if (this.stageOf(tile.crop) !== before) {
          tile.pop = 1;
          grown.push(tile);
        }
      }
      tile.wet = Math.max(0, tile.wet - hours);
    }
    return grown;
  }

  /** Visual "pop" timers for the grow / plant animation (real seconds). */
  animate(dt) {
    for (const tile of this.tiles.values()) {
      if (tile.pop > 0) tile.pop = Math.max(0, tile.pop - dt * 2.5);
    }
  }

  serialize() {
    return {
      size: this.size,
      tiles: [...this.tiles.values()].filter((t) => t.tilled).map((t) => ({
        i: t.i, j: t.j, wet: t.wet, crop: t.crop ? { type: t.crop.type, growth: t.crop.growth } : null,
      })),
    };
  }

  load(data) {
    this.size = data.size;
    this.tiles.clear();
    for (const t of data.tiles) {
      const tile = this.ensure(t.i, t.j);
      tile.tilled = true;
      tile.wet = t.wet;
      tile.crop = t.crop;
      tile.pop = 0;
    }
  }
}
