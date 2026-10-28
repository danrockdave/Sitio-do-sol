/**
 * Day/night cycle: converts the in-game hour into light direction, light
 * colour, sky colours, ambient terms, fog and the night "glow" factor.
 *
 * The sun rises in the east (+X) at 06:00 and sets in the west at 18:00;
 * the moon follows the opposite arc. Colours are interpolated between
 * hand-tuned keyframes.
 */

const KEYS = [
  { h: 0.0, light: [0.20, 0.26, 0.42], top: [0.02, 0.04, 0.10], horizon: [0.07, 0.10, 0.20], sky: [0.17, 0.21, 0.37], ground: [0.07, 0.08, 0.13], cloud: [0.10, 0.12, 0.20], glow: 1.0 },
  { h: 4.6, light: [0.20, 0.26, 0.42], top: [0.04, 0.06, 0.14], horizon: [0.10, 0.12, 0.24], sky: [0.17, 0.21, 0.37], ground: [0.07, 0.08, 0.13], cloud: [0.12, 0.14, 0.22], glow: 1.0 },
  { h: 5.5, light: [0.12, 0.13, 0.22], top: [0.18, 0.22, 0.42], horizon: [0.78, 0.50, 0.44], sky: [0.30, 0.29, 0.40], ground: [0.12, 0.11, 0.12], cloud: [0.85, 0.60, 0.55], glow: 0.8 },
  { h: 6.5, light: [0.90, 0.62, 0.42], top: [0.38, 0.55, 0.82], horizon: [1.00, 0.76, 0.58], sky: [0.46, 0.44, 0.52], ground: [0.23, 0.20, 0.17], cloud: [1.00, 0.86, 0.76], glow: 0.25 },
  { h: 8.5, light: [0.84, 0.81, 0.74], top: [0.30, 0.56, 0.92], horizon: [0.72, 0.86, 0.98], sky: [0.39, 0.44, 0.53], ground: [0.26, 0.24, 0.20], cloud: [1.00, 1.00, 1.00], glow: 0.0 },
  { h: 15.5, light: [0.84, 0.81, 0.74], top: [0.30, 0.56, 0.92], horizon: [0.72, 0.86, 0.98], sky: [0.39, 0.44, 0.53], ground: [0.26, 0.24, 0.20], cloud: [1.00, 1.00, 1.00], glow: 0.0 },
  { h: 17.4, light: [0.95, 0.72, 0.46], top: [0.36, 0.52, 0.82], horizon: [1.00, 0.78, 0.55], sky: [0.48, 0.44, 0.46], ground: [0.27, 0.22, 0.17], cloud: [1.00, 0.88, 0.75], glow: 0.15 },
  { h: 18.6, light: [0.50, 0.28, 0.25], top: [0.18, 0.20, 0.42], horizon: [0.90, 0.50, 0.42], sky: [0.33, 0.29, 0.41], ground: [0.13, 0.11, 0.12], cloud: [0.85, 0.55, 0.55], glow: 0.7 },
  { h: 19.6, light: [0.20, 0.26, 0.42], top: [0.03, 0.05, 0.12], horizon: [0.08, 0.11, 0.22], sky: [0.17, 0.21, 0.37], ground: [0.07, 0.08, 0.13], cloud: [0.12, 0.14, 0.22], glow: 1.0 },
  { h: 24.0, light: [0.20, 0.26, 0.42], top: [0.02, 0.04, 0.10], horizon: [0.07, 0.10, 0.20], sky: [0.17, 0.21, 0.37], ground: [0.07, 0.08, 0.13], cloud: [0.10, 0.12, 0.20], glow: 1.0 },
];

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const normalize = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

function arcDirection(angle) {
  // east (+X) at angle 0, zenith at PI/2, west at PI; tilted toward the south (+Z)
  return normalize([Math.cos(angle), Math.sin(angle) * 1.15, 0.55]);
}

function clampElevation(dir, minY) {
  return normalize([dir[0], Math.max(dir[1], minY), dir[2]]);
}

export function computeEnvironment(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth(0, 1, (h - a.h) / (b.h - a.h));

  const sunAngle = ((h - 6) / 12) * Math.PI;
  const moonAngle = ((((h - 18) % 24) + 24) % 24 / 12) * Math.PI;
  const sunDir = arcDirection(sunAngle);
  const moonDir = arcDirection(moonAngle);

  // Which body lights the scene: sun by day, moon by night, blended at dusk and dawn.
  const dusk = smooth(18.8, 19.4, h);
  const dawn = 1 - smooth(5.0, 5.8, h);
  const moonWeight = h >= 12 ? dusk : dawn;
  const lightDir = normalize(lerp3(clampElevation(sunDir, 0.2), clampElevation(moonDir, 0.35), moonWeight));

  const glow = lerp(a.glow, b.glow, t);
  const sunHeight = Math.sin(sunAngle);
  return {
    hour: h,
    lightDir,
    lightColor: lerp3(a.light, b.light, t),
    skyTop: lerp3(a.top, b.top, t),
    skyHorizon: lerp3(a.horizon, b.horizon, t),
    ambientSky: lerp3(a.sky, b.sky, t),
    ambientGround: lerp3(a.ground, b.ground, t),
    cloudColor: lerp3(a.cloud, b.cloud, t),
    fogColor: lerp3(a.horizon, b.horizon, t),
    fogDensity: lerp(0.010, 0.016, glow),
    glow,
    sunDir,
    moonDir,
    sunVisible: smooth(-0.12, 0.05, sunHeight),
    moonVisible: smooth(-0.1, 0.1, Math.sin(moonAngle)) * glow,
    stars: smooth(0.55, 1.0, glow),
    shadowStrength: lerp(0.85, 0.45, moonWeight) * (1 - 0.6 * smooth(0.35, 0.8, glow) * (1 - moonWeight)),
    isNight: glow > 0.5,
  };
}
