/**
 * Tiny CPU particle system rendered as billboards (dirt puffs, water drops,
 * harvest sparkles, hearts) plus ambient fireflies at night.
 */

export class Particles {
  constructor() {
    this.list = [];
    this.fireflies = [];
    for (let i = 0; i < 40; i++) {
      this.fireflies.push({
        base: [(Math.random() - 0.5) * 44, 0.4 + Math.random() * 1.2, (Math.random() - 0.5) * 36],
        phase: Math.random() * 100,
        speed: 0.3 + Math.random() * 0.5,
      });
    }
  }

  emit(pos, count, { color = [1, 1, 1, 1], speed = 1.5, up = 2, gravity = 6, life = 0.8, size = 0.12, spread = 0.2 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.list.push({
        pos: [pos[0] + (Math.random() - 0.5) * spread, pos[1], pos[2] + (Math.random() - 0.5) * spread],
        vel: [Math.cos(a) * s, up * (0.5 + Math.random() * 0.7), Math.sin(a) * s],
        color: [...color],
        gravity,
        life,
        age: 0,
        size: size * (0.7 + Math.random() * 0.6),
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      p.vel[1] -= p.gravity * dt;
      p.pos[0] += p.vel[0] * dt;
      p.pos[1] = Math.max(0.03, p.pos[1] + p.vel[1] * dt);
      p.pos[2] += p.vel[2] * dt;
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  /** Appends billboards for the renderer. glow = night factor for fireflies. */
  collect(out, time, glow, maxFireflies = this.fireflies.length) {
    for (const p of this.list) {
      const t = p.age / p.life;
      out.push({ pos: p.pos, size: p.size * (1 - t * 0.5), color: [p.color[0], p.color[1], p.color[2], p.color[3] * (1 - t)], mode: 0 });
    }
    if (glow > 0.4) {
      const a = (glow - 0.4) / 0.6;
      for (const f of this.fireflies.slice(0, maxFireflies)) {
        const t = time * f.speed + f.phase;
        const blink = Math.max(0, Math.sin(t * 2.1)) ** 2;
        out.push({
          pos: [f.base[0] + Math.sin(t * 0.7) * 1.5, f.base[1] + Math.sin(t * 1.3) * 0.3, f.base[2] + Math.cos(t * 0.5) * 1.5],
          size: 0.22,
          color: [0.85, 1.0, 0.45, 0.9 * blink * a],
          mode: 0,
        });
      }
    }
  }
}
