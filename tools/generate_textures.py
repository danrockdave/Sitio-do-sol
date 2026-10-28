#!/usr/bin/env python3
"""
Procedural texture generator for "Sítio do Sol".

Writes tileable textures as binary PPM (P6) files into assets/textures/.
PPM was chosen on purpose: the game decodes it with its own parser
(src/loaders/netpbm.js), so no browser image decoding is involved.

Run:  python3 tools/generate_textures.py
"""

import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "textures")
SIZE = 256


def write_ppm(name, rgb):
    """rgb: float array (h, w, 3) in [0, 1]."""
    os.makedirs(OUT_DIR, exist_ok=True)
    data = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)
    h, w, _ = data.shape
    with open(os.path.join(OUT_DIR, name), "wb") as fh:
        fh.write(f"P6\n# Sitio do Sol procedural texture\n{w} {h}\n255\n".encode("ascii"))
        fh.write(data.tobytes())


def value_noise(size, period, seed):
    """Tileable value noise with smoothstep interpolation."""
    rng = np.random.default_rng(seed)
    grid = rng.random((period, period))
    coords = np.arange(size) * period / size
    i0 = np.floor(coords).astype(int)
    f = coords - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % period
    i0 = i0 % period
    # rows (y) x cols (x)
    a = grid[np.ix_(i0, i0)]
    b = grid[np.ix_(i0, i1)]
    c = grid[np.ix_(i1, i0)]
    d = grid[np.ix_(i1, i1)]
    fx = f[None, :]
    fy = f[:, None]
    top = a + (b - a) * fx
    bottom = c + (d - c) * fx
    return top + (bottom - top) * fy


def fbm(size, base_period, octaves, seed, gain=0.5):
    total = np.zeros((size, size))
    amp, norm = 1.0, 0.0
    period = base_period
    for o in range(octaves):
        total += value_noise(size, period, seed + o * 17) * amp
        norm += amp
        amp *= gain
        period *= 2
    return total / norm


def stretched_noise(size, period_x, period_y, seed):
    """Anisotropic noise, used for wood grain and straw fibres."""
    rng = np.random.default_rng(seed)
    grid = rng.random((period_y, period_x))

    def axis(period):
        coords = np.arange(size) * period / size
        i0 = np.floor(coords).astype(int)
        f = coords - i0
        f = f * f * (3 - 2 * f)
        return i0 % period, (i0 + 1) % period, f

    y0, y1, fy = axis(period_y)
    x0, x1, fx = axis(period_x)
    a = grid[np.ix_(y0, x0)]
    b = grid[np.ix_(y0, x1)]
    c = grid[np.ix_(y1, x0)]
    d = grid[np.ix_(y1, x1)]
    top = a + (b - a) * fx[None, :]
    bottom = c + (d - c) * fx[None, :]
    return top + (bottom - top) * fy[:, None]


def voronoi(size, count, seed):
    """Tileable Voronoi: returns (F1 distance, F2 distance, cell id)."""
    rng = np.random.default_rng(seed)
    pts = rng.random((count, 2))
    ys, xs = np.mgrid[0:size, 0:size] / size
    best1 = np.full((size, size), 9.0)
    best2 = np.full((size, size), 9.0)
    cell = np.zeros((size, size), dtype=int)
    for idx, (px, py) in enumerate(pts):
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                d = np.hypot(xs - (px + ox), ys - (py + oy))
                closer = d < best1
                best2 = np.where(closer, best1, np.minimum(best2, d))
                cell = np.where(closer, idx, cell)
                best1 = np.where(closer, d, best1)
    return best1, best2, cell


def colorize(t, dark, light):
    dark = np.array(dark)[None, None, :]
    light = np.array(light)[None, None, :]
    return dark + (light - dark) * t[..., None]


def grass():
    n = fbm(SIZE, 4, 5, 1)
    fine = fbm(SIZE, 32, 2, 2)
    t = np.clip(0.55 * n + 0.45 * fine, 0, 1)
    rgb = colorize(t, (0.33, 0.49, 0.20), (0.53, 0.67, 0.30))
    # little blade strokes
    rng = np.random.default_rng(3)
    for _ in range(900):
        x, y = rng.integers(0, SIZE, 2)
        length = rng.integers(3, 8)
        shade = rng.uniform(-0.10, 0.12)
        for k in range(length):
            yy = (y - k) % SIZE
            xx = (x + (k // 3)) % SIZE
            rgb[yy, xx] += shade
    write_ppm("grass.ppm", rgb)


def dirt():
    n = fbm(SIZE, 4, 5, 10)
    fine = fbm(SIZE, 64, 1, 11)
    t = np.clip(0.6 * n + 0.4 * fine, 0, 1)
    rgb = colorize(t, (0.62, 0.45, 0.30), (0.80, 0.63, 0.44))
    d1, d2, cell = voronoi(SIZE, 70, 12)
    pebble = (d1 < 0.018).astype(float)
    rng = np.random.default_rng(13)
    tones = rng.uniform(0.75, 1.15, 70)[cell]
    rgb = rgb * (1 - pebble[..., None]) + (rgb * tones[..., None] * 1.12) * pebble[..., None]
    write_ppm("dirt.ppm", rgb)


def soil():
    n = fbm(SIZE, 8, 4, 20)
    ys = np.arange(SIZE)[:, None] / SIZE
    furrow = 0.5 + 0.5 * np.cos(ys * 2 * np.pi * 4)
    t = np.clip(0.55 * n + 0.45 * (1 - furrow), 0, 1)
    rgb = colorize(t, (0.36, 0.23, 0.15), (0.58, 0.40, 0.27))
    rgb = rgb * (0.88 + 0.12 * furrow[..., None])
    clods = fbm(SIZE, 32, 2, 21)
    rgb += ((clods > 0.72) * 0.06)[..., None]
    # darker border so each tilled tile reads as a bed
    xs = np.arange(SIZE)[None, :] / SIZE
    edge = np.minimum(np.minimum(xs, 1 - xs), np.minimum(ys, 1 - ys))
    rgb *= (0.78 + 0.22 * np.clip(edge / 0.06, 0, 1))[..., None]
    write_ppm("soil.ppm", rgb)


def wood():
    grain = stretched_noise(SIZE, 4, 48, 30)
    fine = stretched_noise(SIZE, 16, 128, 31)
    t = 0.6 * grain + 0.4 * fine
    rgb = colorize(t, (0.74, 0.70, 0.66), (0.98, 0.95, 0.90))
    # horizontal boards with seams; each board gets its own tone
    boards = 4
    ys = np.arange(SIZE)
    board = (ys * boards) // SIZE
    rng = np.random.default_rng(32)
    tones = rng.uniform(0.88, 1.04, boards)
    rgb *= tones[board][:, None, None]
    local = (ys * boards / SIZE) % 1.0
    seam = np.where((local < 0.045) | (local > 0.965), 0.62, 1.0)
    rgb *= seam[:, None, None]
    # nail dots
    for b in range(boards):
        y = int((b + 0.5) * SIZE / boards)
        for x in (12, SIZE // 2 + 12):
            rgb[y - 2:y + 2, x - 2:x + 2] *= 0.6
    write_ppm("wood.ppm", rgb)


def thatch():
    fibres = stretched_noise(SIZE, 96, 6, 40)
    rows = 6
    ys = np.arange(SIZE)
    local = (ys * rows / SIZE) % 1.0
    layer = 0.75 + 0.25 * local  # darker at the top of each layer
    t = np.clip(0.7 * fibres + 0.3 * fbm(SIZE, 8, 3, 41), 0, 1)
    rgb = colorize(t, (0.72, 0.66, 0.55), (1.0, 0.97, 0.88))
    rgb *= layer[:, None, None]
    write_ppm("thatch.ppm", rgb)


def roof():
    rows, cols = 6, 6
    ys, xs = np.mgrid[0:SIZE, 0:SIZE] / SIZE
    row = np.floor(ys * rows)
    shift = (row % 2) * 0.5 / cols
    cx = ((xs + shift) * cols) % 1.0
    cy = (ys * rows) % 1.0
    rng = np.random.default_rng(50)
    tone_table = rng.uniform(0.85, 1.05, (rows, cols + 1))
    col = np.floor((xs + shift) * cols).astype(int) % (cols + 1)
    tones = tone_table[row.astype(int), col]
    shade = 0.70 + 0.30 * cy  # tiles darken toward the overlap above
    gap = np.where((cx < 0.04) | (cx > 0.96), 0.7, 1.0)
    noise = fbm(SIZE, 16, 2, 51)
    v = tones * shade * gap * (0.9 + 0.1 * noise)
    rgb = np.stack([v, v * 0.97, v * 0.95], axis=-1)
    write_ppm("roof.ppm", rgb)


def stone():
    d1, d2, cell = voronoi(SIZE, 28, 60)
    edge = np.clip((d2 - d1) / 0.035, 0, 1)
    rng = np.random.default_rng(61)
    tones = rng.uniform(0.82, 1.0, 28)[cell]
    noise = fbm(SIZE, 8, 3, 62)
    v = tones * (0.88 + 0.12 * noise) * (0.55 + 0.45 * edge)
    rgb = np.stack([v, v * 0.98, v * 0.95], axis=-1)
    write_ppm("stone.ppm", rgb)


def bark():
    streaks = stretched_noise(SIZE, 24, 3, 70)
    fine = stretched_noise(SIZE, 64, 8, 71)
    t = 0.65 * streaks + 0.35 * fine
    rgb = colorize(t, (0.62, 0.55, 0.50), (0.98, 0.92, 0.86))
    write_ppm("bark.ppm", rgb)


def hay():
    fibres = stretched_noise(SIZE, 4, 96, 80)
    fine = stretched_noise(SIZE, 8, 160, 81)
    t = 0.6 * fibres + 0.4 * fine
    rgb = colorize(t, (0.78, 0.72, 0.55), (1.0, 0.98, 0.90))
    write_ppm("hay.ppm", rgb)


def main():
    for build in (grass, dirt, soil, wood, thatch, roof, stone, bark, hay):
        build()
    print(f"textures written to {OUT_DIR}: {sorted(os.listdir(OUT_DIR))}")


if __name__ == "__main__":
    main()
