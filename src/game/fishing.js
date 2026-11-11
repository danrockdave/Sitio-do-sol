/**
 * Fishing in the lake with the grandfather's bamboo rod.
 *
 *   cast    the bobber flies in an arc to the chosen spot on the water
 *   wait    small nibbles shake the bobber; pulling now scares the fish
 *   bite    the bobber sinks: pull within the time window
 *   reel    timing mini-game: press while the needle is inside the green zone;
 *           harder fish need more hits and move the zone faster; 3 misses lose it
 *   caught  the farmer holds the catch up (size, record, album)
 *
 * Which fish bites depends on the hour, the weather and the story chapter.
 */

import { FISH, BOTTLE_LETTERS, ITEMS } from './data.js';
import { POND, inPond, pondRadius } from './world.js';

export const WATER_Y = 0.1;
export const CAST_RANGE = 6.2;
const CAST_TIME = 0.55;
const MAX_MISSES = 3;

export function hourIn(hour, range) {
  if (!range) return true;
  const [a, b] = range;
  return a < b ? hour >= a && hour < b : hour >= a || hour < b;
}

export class Fishing {
  constructor() {
    this.ripples = [];        // { x, z, t, size, alpha }
    this.tip = null;          // rod tip in world space (written by the scene every frame)
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.t = 0;
    this.target = null;       // [x, z] where the bobber lands
    this.bobber = null;       // [x, y, z] for rendering
    this.from = null;
    this.wait = 0;
    this.nibble = 0;
    this.nextNibble = 0;
    this.window = 0;
    this.hooked = null;       // what is on the line
    this.gauge = null;
    this.result = null;       // { item, name, size, record, first, letter }
    this.anchor = null;       // where the farmer stood when casting
  }

  get active() {
    return this.state !== 'idle';
  }

  /** The farmer cannot walk away while reeling or showing the catch. */
  get locked() {
    return this.state === 'reel' || this.state === 'caught';
  }

  /** Point of the shore closest to a spot of the lake (where to stand to cast there). */
  static shorePoint(x, z) {
    const dx = x - POND.x;
    const dz = z - POND.z;
    const a = Math.atan2(-dz, dx);
    const r = Math.max(pondRadius(a) + 0.55, 3.5);
    return [POND.x + Math.cos(a) * r, POND.z - Math.sin(a) * r];
  }

  /** Where to stand to cast at a spot: the shore point nearest the farmer that reaches it. */
  static standPoint(pos, spot) {
    let best = null;
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      const r = Math.max(pondRadius(a) + 0.55, 3.5);
      const x = POND.x + Math.cos(a) * r;
      const z = POND.z - Math.sin(a) * r;
      if (Math.hypot(spot[0] - x, spot[1] - z) > CAST_RANGE - 0.6) continue;
      const d = Math.hypot(pos[0] - x, pos[2] - z);
      if (!best || d < best.d) best = { d, x, z };
    }
    return best ? [best.x, best.z] : Fishing.shorePoint(spot[0], spot[1]);
  }

  /** Finds a spot on the water in front of the farmer (keyboard / touch button). */
  static spotAhead(pos, forward) {
    for (const d of [3.0, 2.2, 4.0, 1.6, 5.0]) {
      const x = pos[0] + forward[0] * d;
      const z = pos[2] + forward[1] * d;
      if (inPond(x, z, 0.45)) return [x, z];
    }
    return null;
  }

  static canReach(pos, spot) {
    return Math.hypot(spot[0] - pos[0], spot[1] - pos[2]) <= CAST_RANGE && inPond(spot[0], spot[1], 0.35);
  }

  cast(game, spot) {
    this.reset();
    this.state = 'cast';
    this.target = [...spot];
    const p = game.player.pos;
    this.anchor = [p[0], p[2]];
    this.from = this.tip ? [...this.tip] : [p[0], 1.6, p[2]];
    game.player.startAction('cast', spot[0], spot[1]);
    game.sound('cast', null, { volume: 0.9 });
  }

  cancel(game, text = null) {
    if (!this.active) return;
    if (this.state === 'wait' || this.state === 'bite') game.sound('reel', null, { volume: 0.5 });
    this.reset();
    if (text) game.toast(text, 'info');
  }

  /** Action button / click while fishing. */
  press(game) {
    switch (this.state) {
      case 'wait':
        game.toast('Cedo demais! Espere a boia afundar.', 'info');
        game.sound('escape', null, { volume: 0.6 });
        this.reset();
        break;
      case 'bite':
        this._startReel(game);
        break;
      case 'reel':
        this._reelPress(game);
        break;
      case 'caught':
        if (this.t > 0.6) this.reset();
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------
  // what bites
  // ------------------------------------------------------------------

  _pick(game, random) {
    const hour = game.clock.hour;
    const rain = game.weather.raining;
    const night = hour >= 19 || hour < 5;
    const chapter = game.progress.chapter;
    const bottles = game.progress.bottlesFound();
    if (chapter >= 2 && bottles < BOTTLE_LETTERS.length && random() < 0.06) {
      return { kind: 'bottle', letter: BOTTLE_LETTERS[bottles], difficulty: 1 };
    }
    if (random() < 0.05) return { kind: 'junk', item: 'old_boot', difficulty: 1 };
    const legendHour = hour >= 4.5 && hour < 10;
    if (chapter >= 6 && rain && legendHour && random() < (game.progress.finished ? 0.15 : 0.32)) {
      return this._fish('dourado', random);
    }
    const options = [];
    let total = 0;
    for (const [species, fish] of Object.entries(FISH)) {
      if (fish.legendary) continue;
      if (!hourIn(hour, fish.hours) && !(fish.hours2 && hourIn(hour, fish.hours2))) continue;
      let w = fish.weight;
      if (rain && fish.rain) w *= fish.rain;
      if (night && fish.night) w *= fish.night;
      options.push([species, w]);
      total += w;
    }
    let r = random() * total;
    for (const [species, w] of options) {
      if (r < w) return this._fish(species, random);
      r -= w;
    }
    return this._fish('lambari', random);
  }

  _fish(species, random) {
    const fish = FISH[species];
    const [a, b] = fish.size;
    const size = Math.round((a + (b - a) * Math.pow(random(), 1.6)) * 10) / 10;
    return { kind: 'fish', species, item: fish.item, size, difficulty: fish.difficulty };
  }

  // ------------------------------------------------------------------
  // update
  // ------------------------------------------------------------------

  update(dt, game, random = Math.random) {
    this._updateRipples(dt, game, random);
    if (!this.active) return;
    this.t += dt;
    const time = game.time;

    // walking away or putting the rod down reels the line in
    const p = game.player.pos;
    const walkedAway = this.anchor && Math.hypot(p[0] - this.anchor[0], p[2] - this.anchor[1]) > 0.4;
    if (!this.locked && (walkedAway || game.tool !== 'rod')) {
      this.cancel(game);
      return;
    }

    switch (this.state) {
      case 'cast': {
        const k = Math.min(1, this.t / CAST_TIME);
        const from = this.tip || this.from;
        this.bobber = [
          from[0] + (this.target[0] - from[0]) * k,
          from[1] + (WATER_Y - from[1]) * k + Math.sin(k * Math.PI) * 1.4,
          from[2] + (this.target[1] - from[2]) * k,
        ];
        if (k >= 1) {
          this.state = 'wait';
          this.t = 0;
          const rainy = game.weather.raining ? 0.72 : 1;
          const h = game.clock.hour;
          const golden = (h >= 5 && h < 8) || (h >= 17 && h < 20) ? 0.82 : 1;
          this.wait = (2 + random() * 6) * rainy * golden;
          this.nextNibble = 0.8 + random() * 1.2;
          this._splash(game, 1);
          game.sound('splash', [this.target[0], 0, this.target[1]], { volume: 0.8 });
        }
        break;
      }
      case 'wait': {
        this.nibble = Math.max(0, this.nibble - dt * 5);
        if (this.t >= this.nextNibble && this.t < this.wait - 0.5) {
          this.nibble = 1;
          this.nextNibble = this.t + 0.7 + random() * 1.6;
          this._ripple(this.target[0], this.target[1], 0.5, 0.5);
          game.sound('nibble', [this.target[0], 0, this.target[1]], { volume: 0.5 });
        }
        if (this.t >= this.wait) {
          this.hooked = this._pick(game, random);
          this.state = 'bite';
          this.t = 0;
          this.window = 1.0 - 0.05 * this.hooked.difficulty;
          this._splash(game, 1.4);
          game.sound('bite', null, { volume: 1 });
        }
        this.bobber = [this.target[0], WATER_Y + Math.sin(time * 2.6) * 0.015 - this.nibble * 0.05, this.target[1]];
        break;
      }
      case 'bite':
        this.bobber = [this.target[0] + Math.sin(time * 40) * 0.03, WATER_Y - 0.11, this.target[1]];
        if (this.t >= this.window) {
          game.toast('O peixe roubou a isca. Tente de novo!', 'info');
          game.sound('escape', null, { volume: 0.7 });
          this.reset();
        }
        break;
      case 'reel':
        this._updateReel(dt, game, random);
        break;
      case 'caught':
        if (this.t > 3.2) this.reset();
        break;
      default:
        break;
    }
  }

  _startReel(game) {
    const d = this.hooked.difficulty;
    this.state = 'reel';
    this.t = 0;
    this.gauge = {
      needle: 0,
      dir: 1,
      speed: 0.75 + 0.22 * d,
      zone: 0.35 + Math.random() * 0.3,
      width: Math.max(0.12, 0.3 - 0.035 * d),
      drift: d >= 4 ? 0.12 * (d - 3) : 0,
      hits: 0,
      need: this.hooked.kind === 'fish' ? Math.max(2, d) : 1,
      misses: 0,
      flash: 0,
      flashGood: true,
    };
    game.sound('reel', null, { volume: 0.9 });
  }

  _updateReel(dt, game) {
    const g = this.gauge;
    g.needle += g.dir * g.speed * dt;
    if (g.needle > 1) { g.needle = 2 - g.needle; g.dir = -1; }
    if (g.needle < 0) { g.needle = -g.needle; g.dir = 1; }
    if (g.drift) {
      g.zone += Math.sin(this.t * 2.3) * g.drift * dt;
      g.zone = Math.min(1 - g.width / 2, Math.max(g.width / 2, g.zone));
    }
    g.flash = Math.max(0, g.flash - dt * 3);
    // the bobber comes closer with every good pull
    const p = game.player.pos;
    const k = g.hits / g.need;
    const shake = Math.sin(game.time * 30) * 0.04;
    this.bobber = [
      this.target[0] + (p[0] - this.target[0]) * k * 0.6 + shake,
      WATER_Y - 0.06,
      this.target[1] + (p[2] - this.target[1]) * k * 0.6,
    ];
  }

  _reelPress(game) {
    const g = this.gauge;
    const inside = Math.abs(g.needle - g.zone) <= g.width / 2;
    g.flash = 1;
    g.flashGood = inside;
    if (inside) {
      g.hits += 1;
      game.sound('reel', null, { volume: 1, pitch: 1 + g.hits * 0.08 });
      this._ripple(this.bobber[0], this.bobber[2], 0.6, 0.7);
      if (g.hits >= g.need) {
        this._land(game);
        return;
      }
      g.zone = g.width / 2 + Math.random() * (1 - g.width);
      g.speed *= 1.08;
    } else {
      g.misses += 1;
      game.sound('miss', null, { volume: 0.8 });
      if (g.misses >= MAX_MISSES) {
        game.toast(this.hooked.kind === 'fish' ? 'A linha afrouxou e o peixe escapou!' : 'Escapou!', 'bad');
        game.sound('escape');
        this.reset();
      }
    }
  }

  _land(game) {
    const hooked = this.hooked;
    this.state = 'caught';
    this.t = 0;
    this._splash(game, 1.6);
    game.sound('catch', null, { volume: 1 });
    this.result = game.landCatch(hooked);
    this.bobber = null;
  }

  // ------------------------------------------------------------------
  // water effects
  // ------------------------------------------------------------------

  _ripple(x, z, size, alpha) {
    this.ripples.push({ x, z, t: 0, size, alpha });
    if (this.ripples.length > 40) this.ripples.shift();
  }

  _splash(game, strength) {
    const [x, z] = this.target;
    this._ripple(x, z, 0.8 * strength, 0.8);
    this._ripple(x, z, 0.5 * strength, 0.6);
    game.particles.emit([x, WATER_Y + 0.05, z], Math.round(8 * strength), {
      color: [0.75, 0.88, 1, 0.9], speed: 0.9, up: 2.2, gravity: 7, life: 0.55, size: 0.08,
    });
  }

  _updateRipples(dt, game, random) {
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 1.6);
    const rain = game.weather.rain;
    if (rain > 0.2) {
      let n = dt * 14 * rain;
      while (n > 0) {
        if (random() < n) {
          const a = random() * Math.PI * 2;
          const d = Math.sqrt(random()) * (pondRadius(a) - 0.3);
          this._ripple(POND.x + Math.cos(a) * d, POND.z - Math.sin(a) * d, 0.3 + random() * 0.2, 0.45);
        }
        n -= 1;
      }
    }
  }
}

/** Label for a catch (for toasts and the popup). */
export function catchName(hooked) {
  if (hooked.kind === 'bottle') return 'Garrafa com bilhete';
  return ITEMS[hooked.item].name;
}
