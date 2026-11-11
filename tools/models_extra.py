"""
Extra procedural models for "Sítio do Sol" (second content update):
new crops, animals, fish and fishing gear, production machines, the
village order board, the mailbox, the golden ipê tree, artisan goods
and small icon shapes.

Imported by tools/generate_models.py, which owns the primitives, the
material table and the OBJ/MTL writer. Same conventions: Y up, models
face +Z, the origin sits on the ground, 1 unit = 1 farm tile.
"""

import math

import numpy as np

import generate_models as g
from generate_models import (Model, T, S, Rx, Ry, Rz, chain, box, cylinder, sphere, prism, quad_xy, blade,
                             blob, leaf_fan, jitter_faces, seeds_stage, sprout_stage, gable_building, pumpkin_faces)

g.MATERIALS.update({
    # crops
    "lettuce": dict(kd=(0.62, 0.86, 0.34), ks=0.10, ns=14),
    "lettuce_dark": dict(kd=(0.36, 0.66, 0.22), ks=0.10, ns=14),
    "potato": dict(kd=(0.80, 0.62, 0.40), ks=0.05, ns=8),
    "potato_eye": dict(kd=(0.52, 0.36, 0.22), ks=0.05, ns=8),
    "strawberry": dict(kd=(0.93, 0.13, 0.19), ks=0.60, ns=60),
    "strawberry_green": dict(kd=(0.70, 0.85, 0.40), ks=0.30, ns=30),
    "strawberry_seed": dict(kd=(0.99, 0.88, 0.40), ks=0.20, ns=20),
    "sunflower_petal": dict(kd=(1.00, 0.80, 0.10), ks=0.10, ns=14),
    "sunflower_core": dict(kd=(0.42, 0.26, 0.10), ks=0.10, ns=12),
    "cassava": dict(kd=(0.60, 0.40, 0.24), ks=0.05, ns=8),
    "cassava_flesh": dict(kd=(0.98, 0.95, 0.86), ks=0.10, ns=12),
    "cassava_stem": dict(kd=(0.62, 0.48, 0.38), ks=0.05, ns=8),
    "melon_dark": dict(kd=(0.16, 0.42, 0.18), ks=0.45, ns=40),
    "melon_light": dict(kd=(0.50, 0.76, 0.34), ks=0.45, ns=40),
    "melon_flesh": dict(kd=(0.95, 0.30, 0.32), ks=0.30, ns=30),
    "mango": dict(kd=(0.99, 0.72, 0.16), ks=0.50, ns=50),
    "mango_red": dict(kd=(0.93, 0.36, 0.20), ks=0.50, ns=50),
    "petal_lilac": dict(kd=(0.82, 0.72, 0.96), ks=0.15, ns=20),
    # animals
    "goat_fur": dict(kd=(0.90, 0.84, 0.74), ks=0.05, ns=8),
    "goat_dark": dict(kd=(0.46, 0.32, 0.22), ks=0.05, ns=8),
    "pig_pink": dict(kd=(0.98, 0.72, 0.72), ks=0.15, ns=16),
    "pig_snout": dict(kd=(0.94, 0.54, 0.58), ks=0.15, ns=16),
    # fish and fishing
    "fish_silver": dict(kd=(0.80, 0.84, 0.88), ks=0.85, ns=80),
    "fish_belly": dict(kd=(0.97, 0.96, 0.93), ks=0.60, ns=60),
    "fin_yellow": dict(kd=(0.99, 0.78, 0.24), ks=0.30, ns=30),
    "fin_red": dict(kd=(0.92, 0.36, 0.24), ks=0.30, ns=30),
    "fish_tilapia": dict(kd=(0.52, 0.60, 0.56), ks=0.70, ns=60),
    "fish_traira": dict(kd=(0.36, 0.33, 0.22), ks=0.50, ns=40),
    "fish_carp": dict(kd=(0.84, 0.62, 0.30), ks=0.80, ns=70),
    "fish_tucunare": dict(kd=(0.74, 0.78, 0.30), ks=0.70, ns=60),
    "fish_pintado": dict(kd=(0.80, 0.80, 0.76), ks=0.70, ns=60),
    "fish_gold": dict(kd=(1.00, 0.70, 0.12), ks=0.95, ns=100, ke=(0.35, 0.20, 0.02)),
    "fin_gold": dict(kd=(0.99, 0.46, 0.10), ks=0.80, ns=80),
    "fish_dark": dict(kd=(0.12, 0.11, 0.10), ks=0.30, ns=30),
    "boot_leather": dict(kd=(0.36, 0.22, 0.12), ks=0.20, ns=20),
    "glass": dict(kd=(0.55, 0.80, 0.70), ks=0.95, ns=120),
    "paper": dict(kd=(0.97, 0.94, 0.84), ks=0.05, ns=8),
    "cork": dict(kd=(0.72, 0.54, 0.34), ks=0.05, ns=8),
    "bamboo": dict(kd=(0.86, 0.78, 0.48), ks=0.25, ns=30),
    "line": dict(kd=(0.96, 0.96, 0.96), ks=0.30, ns=30),
    "bobber_red": dict(kd=(0.93, 0.18, 0.15), ks=0.60, ns=60),
    # machines, buildings and props
    "copper": dict(kd=(0.86, 0.50, 0.30), ks=0.85, ns=70),
    "clay": dict(kd=(0.82, 0.50, 0.34), ks=0.08, ns=10, map="stone.ppm"),
    "soot": dict(kd=(0.12, 0.10, 0.09), ks=0.05, ns=8),
    "fire": dict(kd=(0.99, 0.55, 0.15), ks=0.20, ns=20, ke=(1.00, 0.55, 0.15)),
    "hive_paint": dict(kd=(0.99, 0.84, 0.40), ks=0.10, ns=12, map="wood.ppm"),
    "mailbox": dict(kd=(0.32, 0.47, 0.78), ks=0.60, ns=50),
    "ipe_yellow": dict(kd=(1.00, 0.82, 0.16), ks=0.10, ns=14),
    "ipe_yellow_dark": dict(kd=(0.96, 0.66, 0.10), ks=0.10, ns=14),
    "fabric_blue": dict(kd=(0.38, 0.56, 0.86), ks=0.05, ns=8),
    "fabric_red": dict(kd=(0.86, 0.32, 0.30), ks=0.05, ns=8),
    # artisan goods
    "cheese": dict(kd=(0.99, 0.86, 0.42), ks=0.25, ns=24),
    "cheese_rind": dict(kd=(0.94, 0.70, 0.30), ks=0.20, ns=20),
    "goat_cheese": dict(kd=(0.98, 0.97, 0.90), ks=0.15, ns=16),
    "herb": dict(kd=(0.30, 0.50, 0.22), ks=0.05, ns=8),
    "jam_apple": dict(kd=(0.72, 0.22, 0.14), ks=0.70, ns=70),
    "jam_orange": dict(kd=(0.98, 0.52, 0.10), ks=0.70, ns=70),
    "jam_strawberry": dict(kd=(0.78, 0.06, 0.18), ks=0.70, ns=70),
    "jam_mango": dict(kd=(0.99, 0.74, 0.14), ks=0.70, ns=70),
    "jam_pumpkin": dict(kd=(0.96, 0.46, 0.10), ks=0.60, ns=60),
    "honey": dict(kd=(0.98, 0.64, 0.10), ks=0.85, ns=80),
    "cake": dict(kd=(0.99, 0.84, 0.46), ks=0.10, ns=12),
    "cake_top": dict(kd=(0.86, 0.56, 0.22), ks=0.15, ns=16),
    "tapioca": dict(kd=(0.99, 0.98, 0.94), ks=0.08, ns=10),
    "truffle": dict(kd=(0.24, 0.17, 0.13), ks=0.15, ns=16),
    "duck_egg": dict(kd=(0.84, 0.93, 0.90), ks=0.45, ns=40),
    "cap_green": dict(kd=(0.32, 0.64, 0.34), ks=0.40, ns=40),
    # icons
    "heart": dict(kd=(0.96, 0.30, 0.42), ks=0.50, ns=50),
    "check": dict(kd=(0.38, 0.72, 0.28), ks=0.30, ns=30),
    "seal": dict(kd=(0.82, 0.18, 0.18), ks=0.50, ns=50),
    "book": dict(kd=(0.58, 0.30, 0.20), ks=0.20, ns=20),
    "cloud": dict(kd=(0.97, 0.98, 1.00), ks=0.10, ns=12),
    "cloud_dark": dict(kd=(0.62, 0.66, 0.74), ks=0.10, ns=12),
    "raindrop": dict(kd=(0.35, 0.60, 0.96), ks=0.80, ns=60),
})


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def flat_leaf(r, squash=0.28, length=1.35, seed=0, jitter=0.0, seg=(6, 3)):
    """Rounded leaf: a flattened, stretched sphere lying in XZ, pointing +Z."""
    faces = sphere(r, seg[0], seg[1])
    if jitter:
        faces = jitter_faces(faces, jitter, seed)
    return g.transform_faces(faces, chain(T(0, 0, r * length * 0.85), S(1.0, squash, length)))


def leaf_ring(m, obj, mats, count, r, dist, y, tilt, seed=0, twist=0.0):
    """Ring of rounded leaves around the stem, tilted up by `tilt` degrees."""
    rng = np.random.default_rng(seed)
    for i in range(count):
        ang = 360.0 * i / count + twist + rng.uniform(-10, 10)
        mat = mats[i % len(mats)]
        m.add(obj, mat, flat_leaf(r * rng.uniform(0.85, 1.12), seed=seed + i, jitter=r * 0.06),
              chain(T(0, y, 0), Ry(ang), T(0, 0, dist), Rx(-tilt + rng.uniform(-6, 6))))


def palmate(m, obj, mat, top, count=7, length=0.24, width=0.06, droop=72, seed=0):
    """Hand-shaped leaf (cassava): blades fanning out from one point."""
    rng = np.random.default_rng(seed)
    for i in range(count):
        ang = 360.0 * i / count + rng.uniform(-8, 8)
        m.add(obj, mat, blade(width, length * rng.uniform(0.85, 1.1), 0.0), chain(T(*top), Ry(ang), Rx(droop)))


def striped_sphere(m, obj, r, mats, bands, mat_transform, seg_u=16, seg_v=9):
    """Sphere whose faces alternate materials by longitude (watermelon stripes)."""
    faces = sphere(r, seg_u, seg_v)
    buckets = {mat: [] for mat in mats}
    for f in faces:
        c = sum(f["p"]) / len(f["p"])
        lon = math.atan2(-c[2], c[0]) % (2 * math.pi)
        band = int(lon / (2 * math.pi) * bands) % len(mats)
        buckets[mats[band]].append(f)
    for mat, fs in buckets.items():
        if fs:
            m.add(obj, mat, fs, mat_transform)


def half_disc(r, h, seg=10):
    """D-shaped slab (half cylinder cut along X) standing on y = 0, curve toward +Z."""
    a = np.array
    faces = []
    pts_top, pts_bot = [], []
    for i in range(seg + 1):
        ang = math.pi * i / seg
        x, z = math.cos(ang) * r, math.sin(ang) * r
        pts_bot.append(a([x, 0, z]))
        pts_top.append(a([x, h, z]))
    for i in range(seg):
        faces.append(dict(p=[pts_bot[i + 1], pts_bot[i], pts_top[i], pts_top[i + 1]], uv=None))
    faces.append(dict(p=pts_top[::-1], uv=None))
    faces.append(dict(p=pts_bot, uv=None))
    faces.append(dict(p=[pts_bot[0], pts_bot[-1], pts_top[-1], pts_top[0]], uv=None))
    return faces


def star_prism(r_out, r_in, depth, points=5):
    """Five-point star extruded along Z, centred on the origin, facing +Z."""
    a = np.array
    ring = []
    for i in range(points * 2):
        ang = math.pi / 2 + math.pi * i / points
        r = r_out if i % 2 == 0 else r_in
        ring.append((math.cos(ang) * r, math.sin(ang) * r))
    front = [a([x, y, depth / 2]) for x, y in ring]
    back = [a([x, y, -depth / 2]) for x, y in ring]
    centre_f, centre_b = a([0, 0, depth / 2]), a([0, 0, -depth / 2])
    faces = []
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n
        faces.append(dict(p=[centre_f, front[i], front[j]], uv=None))
        faces.append(dict(p=[centre_b, back[j], back[i]], uv=None))
        faces.append(dict(p=[front[i], back[i], back[j], front[j]], uv=None))
    return faces


def flower(m, obj, petal_mat, pos, size=1.0, petals=5, core="flower_core"):
    x, y, z = pos
    for k in range(petals):
        m.add(obj, petal_mat, box(0.05 * size, 0.015 * size, 0.04 * size),
              chain(T(x, y, z), Ry(360 / petals * k), T(0, 0, 0.03 * size)))
    m.add(obj, core, box(0.03 * size, 0.025 * size, 0.03 * size), T(x, y + 0.008 * size, z))


# ---------------------------------------------------------------------------
# crops (5 stages each + item)
# ---------------------------------------------------------------------------


def make_lettuce():
    seeds_stage("lettuce")
    sprout_stage("lettuce", "lettuce")
    m = Model("lettuce_2")
    leaf_ring(m, "plant", ["lettuce", "lettuce_dark"], 5, 0.06, 0.02, 0.03, 35, seed=1)
    m.write()
    m = Model("lettuce_3")
    leaf_ring(m, "plant", ["lettuce_dark", "lettuce"], 7, 0.09, 0.04, 0.03, 28, seed=2)
    leaf_ring(m, "plant", ["lettuce"], 4, 0.07, 0.01, 0.05, 60, seed=3, twist=40)
    m.write()
    m = Model("lettuce_4")
    leaf_ring(m, "plant", ["lettuce_dark", "lettuce"], 8, 0.12, 0.08, 0.03, 22, seed=4)
    m.add("plant", "lettuce", jitter_faces(sphere(0.15, 9, 6), 0.012, 5), chain(T(0, 0.13, 0), S(1.0, 0.82, 1.0)))
    leaf_ring(m, "plant", ["lettuce"], 5, 0.09, 0.06, 0.12, 55, seed=6, twist=20)
    m.write()
    m = Model("lettuce_item")
    m.add("item", "lettuce", jitter_faces(sphere(0.2, 10, 7), 0.015, 7), S(1.0, 0.85, 1.0))
    leaf_ring(m, "item", ["lettuce_dark", "lettuce"], 7, 0.13, 0.08, -0.08, 30, seed=8)
    m.write()


def make_potato():
    seeds_stage("potato", "potato")
    sprout_stage("potato", "leaf")

    def bush(name, blobs, height, flowers, tubers, seed):
        m = Model(name)
        rng = np.random.default_rng(seed)
        m.add("plant", "stalk", box(0.03, height * 0.7, 0.03), T(0, height * 0.35, 0))
        for i in range(blobs):
            a = rng.uniform(0, 2 * math.pi)
            d = rng.uniform(0.03, 0.12)
            y = rng.uniform(0.35, 1.0) * height
            r = rng.uniform(0.06, 0.09) * (0.8 + height)
            m.add("plant", "leaf" if i % 2 else "leaf_dark", blob(r, 6, 4, 0.015, i + seed),
                  T(math.cos(a) * d, y, math.sin(a) * d))
        for i in range(flowers):
            a = 2 * math.pi * i / max(flowers, 1) + 0.3
            flower(m, "plant", "petal_lilac" if i % 2 else "petal_white",
                   (math.cos(a) * 0.08, height + 0.06, math.sin(a) * 0.08), 1.1)
        for i in range(tubers):
            a = 2 * math.pi * i / max(tubers, 1) + 1.0
            m.add("plant", "potato", blob(0.055, 6, 4, 0.01, 30 + i),
                  chain(T(math.cos(a) * 0.17, 0.02, math.sin(a) * 0.17), S(1.2, 0.8, 1.0)))
        m.write()

    bush("potato_2", 5, 0.16, 0, 0, 3)
    bush("potato_3", 9, 0.30, 0, 0, 4)
    bush("potato_4", 11, 0.34, 4, 3, 5)
    m = Model("potato_item")
    m.add("item", "potato", jitter_faces(sphere(0.2, 9, 6), 0.025, 9), S(1.25, 0.85, 1.0))
    rng = np.random.default_rng(11)
    for i in range(5):
        a = rng.uniform(0, 2 * math.pi)
        y = rng.uniform(-0.08, 0.1)
        m.add("item", "potato_eye", box(0.03, 0.03, 0.02), chain(Ry(math.degrees(a)), T(0, y, 0.18)))
    m.write()


def strawberry_berry(m, obj, mat, pos, size):
    x, y, z = pos
    base = chain(T(x, y, z), S(size))
    m.add(obj, mat, cylinder(0.012, 0.05, 0.07, seg=7), chain(base, T(0, -0.07, 0)))
    m.add(obj, mat, sphere(0.05, 7, 3), chain(base, S(1.0, 0.45, 1.0)))
    for k in range(4):
        m.add(obj, "leaf_dark", box(0.02, 0.008, 0.05), chain(base, T(0, 0.02, 0), Ry(90 * k), T(0, 0, 0.02)))


def make_strawberry():
    seeds_stage("strawberry")
    sprout_stage("strawberry", "leaf")

    def plant(name, leaves, scale, flowers, berries, seed):
        m = Model(name)
        rng = np.random.default_rng(seed)
        for i in range(leaves):
            ang = 360.0 * i / leaves + rng.uniform(-12, 12)
            ln = 0.13 * scale * rng.uniform(0.85, 1.1)
            tilt = 40 + rng.uniform(-8, 8)
            stem = chain(Ry(ang), Rx(tilt))
            m.add("plant", "stalk", box(0.012, ln, 0.012), chain(stem, T(0, ln / 2, 0)))
            for k in (-1, 0, 1):
                m.add("plant", "leaf" if (i + k) % 2 else "leaf_dark", flat_leaf(0.04 * scale, seed=i * 3 + k),
                      chain(stem, T(0, ln, 0), Rx(-tilt), Ry(40 * k)))
        for i in range(flowers):
            a = 2 * math.pi * i / max(flowers, 1) + 0.5
            flower(m, "plant", "petal_white", (math.cos(a) * 0.1, 0.12 * scale, math.sin(a) * 0.1), 1.2)
        for i, (mat, d) in enumerate(berries):
            a = 2 * math.pi * i / max(len(berries), 1) + 0.9
            strawberry_berry(m, "plant", mat, (math.cos(a) * d, 0.08, math.sin(a) * d), 1.0)
        m.write()

    plant("strawberry_2", 4, 0.9, 0, [], 1)
    plant("strawberry_3", 6, 1.15, 3, [], 2)
    plant("strawberry_4", 7, 1.25, 1, [("strawberry", 0.17), ("strawberry", 0.15), ("strawberry_green", 0.16),
                                        ("strawberry", 0.18), ("strawberry", 0.14)], 3)
    m = Model("strawberry_item")
    m.add("item", "strawberry", cylinder(0.035, 0.19, 0.26, seg=12), T(0, -0.2, 0))
    m.add("item", "strawberry", sphere(0.19, 12, 5), chain(T(0, 0.06, 0), S(1.0, 0.45, 1.0)))
    rng = np.random.default_rng(4)
    for i in range(14):
        a = rng.uniform(0, 2 * math.pi)
        y = rng.uniform(-0.15, 0.05)
        r = 0.035 + (0.19 - 0.035) * (y + 0.2) / 0.26
        m.add("item", "strawberry_seed", box(0.022, 0.03, 0.02), chain(Ry(math.degrees(a)), T(0, y, r)))
    for k in range(6):
        m.add("item", "leaf", blade(0.08, 0.14, 0.0), chain(T(0, 0.1, 0), Ry(60 * k), Rx(78)))
    m.add("item", "stalk", box(0.025, 0.08, 0.025), T(0, 0.14, 0))
    m.write()


def sunflower_head(m, obj, pos, r, tilt=70.0):
    base = chain(T(*pos), Rx(tilt))
    m.add(obj, "leaf_dark", cylinder(r * 0.9, r * 0.75, 0.05, seg=12), chain(base, T(0, -0.05, 0)))
    m.add(obj, "sunflower_core", cylinder(r, r * 0.9, 0.04, seg=12), base)
    for k in range(16):
        m.add(obj, "sunflower_petal", box(r * 0.32, 0.02, r * 0.85), chain(base, T(0, 0.02, 0), Ry(22.5 * k), T(0, 0, r * 1.25)))


def make_sunflower():
    seeds_stage("sunflower", "sunflower_core")
    sprout_stage("sunflower", "leaf")

    def stalk(name, height, leaves, head, bud):
        m = Model(name)
        m.add("plant", "stalk", cylinder(0.035, 0.025, height, seg=6), None)
        for i in range(leaves):
            y = height * (0.2 + 0.6 * i / max(leaves, 1))
            m.add("plant", "leaf" if i % 2 else "leaf_dark", flat_leaf(0.08 + 0.02 * (height > 0.8), seed=i),
                  chain(T(0, y, 0), Ry(i * 137.5), Rx(-20)))
        if bud:
            m.add("plant", "leaf_dark", blob(0.07, 7, 5, 0.0), T(0, height + 0.04, 0))
        if head:
            m.add("plant", "stalk", box(0.03, 0.12, 0.03), chain(T(0, height, 0), Rx(30), T(0, 0.05, 0)))
            sunflower_head(m, "plant", (0, height + 0.1, 0.07), 0.15)
        m.write()

    stalk("sunflower_2", 0.32, 2, False, False)
    stalk("sunflower_3", 0.9, 4, False, True)
    stalk("sunflower_4", 1.4, 6, True, False)
    m = Model("sunflower_item")
    sunflower_head(m, "item", (0, 0, 0), 0.2, tilt=90)
    m.add("item", "stalk", box(0.04, 0.3, 0.04), T(0, -0.3, -0.04))
    m.write()


def make_cassava():
    seeds_stage("cassava", "cassava_stem")
    sprout_stage("cassava", "leaf")

    def plant(name, stalks, height, clusters, roots, seed):
        m = Model(name)
        rng = np.random.default_rng(seed)
        for s in range(stalks):
            a = 2 * math.pi * s / stalks + 0.4
            lean = 8 if stalks > 1 else 0
            base = chain(T(math.cos(a) * 0.04, 0, math.sin(a) * 0.04), Ry(math.degrees(a)), Rz(lean))
            h = height * rng.uniform(0.85, 1.05)
            m.add("plant", "cassava_stem", cylinder(0.025, 0.018, h, seg=6), base)
            for c in range(clusters):
                y = h * (0.6 + 0.4 * (c + 1) / clusters)
                top = (base @ np.array([0, y, 0, 1]))[:3]
                palmate(m, "plant", "leaf" if c % 2 else "leaf_dark", tuple(top), count=7,
                        length=0.16 + 0.05 * height, width=0.05, droop=68 + c * 6, seed=seed + s * 10 + c)
        for i in range(roots):
            a = 2 * math.pi * i / max(roots, 1)
            m.add("plant", "cassava", cylinder(0.04, 0.0, 0.16, seg=6),
                  chain(T(math.cos(a) * 0.06, 0.03, math.sin(a) * 0.06), Ry(-math.degrees(a)), Rz(-80)))
        m.write()

    plant("cassava_2", 1, 0.28, 1, 0, 1)
    plant("cassava_3", 1, 0.75, 2, 0, 2)
    plant("cassava_4", 2, 1.0, 3, 3, 3)
    m = Model("cassava_item")
    for i, (dx, rot) in enumerate([(-0.08, -12), (0.08, 10), (0.0, 0)]):
        m.add("item", "cassava", jitter_faces(cylinder(0.075, 0.03, 0.55, seg=8), 0.01, i),
              chain(T(dx, -0.02 * i, 0.03 * i), Rz(90 + rot), T(0, -0.27, 0)))
    m.add("item", "cassava_flesh", cylinder(0.068, 0.068, 0.01, seg=8), chain(T(0.29, 0.0, 0.06), Rz(90)))
    m.write()


def make_watermelon():
    seeds_stage("watermelon", "eye")
    sprout_stage("watermelon", "leaf")
    for stage, leaves, fruit in ((2, 4, 0.0), (3, 6, 0.08), (4, 7, 0.2)):
        m = Model(f"watermelon_{stage}")
        rng = np.random.default_rng(stage + 70)
        for i in range(leaves):
            ang = 360 * i / leaves + rng.uniform(-15, 15)
            dist = 0.1 + 0.08 * stage * rng.uniform(0.7, 1.0)
            m.add("plant", "leaf" if i % 2 else "leaf_dark",
                  jitter_faces(cylinder(0.1 + 0.02 * stage, 0.08, 0.02, seg=7), 0.012, i),
                  chain(Ry(ang), T(dist, 0.04 + 0.03 * (i % 2), 0), Rz(-12)))
            m.add("plant", "stalk", box(dist, 0.02, 0.02), chain(Ry(ang), T(dist / 2, 0.03, 0)))
        if fruit > 0:
            striped_sphere(m, "plant", fruit, ["melon_dark", "melon_light"], 14,
                           chain(T(-0.04, fruit * 0.72, 0.05), Ry(25), S(1.3, 0.78, 1.0)))
        m.write()
    m = Model("watermelon_item")
    striped_sphere(m, "item", 0.22, ["melon_dark", "melon_light"], 14, chain(Rz(90), S(1.0, 1.3, 1.0)))
    m.add("item", "stalk", box(0.03, 0.06, 0.03), chain(T(0.29, 0.0, 0), Rz(-70)))
    m.write()


# ---------------------------------------------------------------------------
# animals
# ---------------------------------------------------------------------------


def make_duck():
    m = Model("duck")
    m.add("body", "white_fur", blob(0.17, 8, 6, 0.01, 2), chain(T(0, 0.22, -0.02), S(1.0, 0.82, 1.35)))
    m.add("body", "white_fur", box(0.12, 0.08, 0.1, top_scale=(0.5, 0.6)), chain(T(0, 0.29, -0.24), Rx(-35)))
    for side, name in ((-1, "wing_l"), (1, "wing_r")):
        m.add(name, "white_fur", box(0.04, 0.1, 0.24), T(0.16 * side, 0.24, -0.03))
    m.add("head", "white_fur", box(0.08, 0.16, 0.08), T(0, 0.34, 0.15))
    m.add("head", "white_fur", blob(0.085, 7, 5, 0.0), T(0, 0.45, 0.17))
    m.add("head", "beak", box(0.08, 0.03, 0.11, top_scale=(0.8, 0.9)), T(0, 0.43, 0.27))
    for side in (-1, 1):
        m.add("head", "eye", box(0.02, 0.025, 0.025), T(0.07 * side, 0.47, 0.2))
    for side, name in ((-1, "leg_l"), (1, "leg_r")):
        m.add(name, "beak", box(0.025, 0.1, 0.025), T(0.05 * side, 0.06, 0))
        m.add(name, "beak", box(0.08, 0.012, 0.09, top_scale=(1.2, 1.0)), T(0.05 * side, 0.006, 0.03))
    m.write()


def make_goat():
    m = Model("goat")
    m.add("body", "goat_fur", box(0.40, 0.40, 0.74), T(0, 0.64, 0))
    m.add("body", "goat_dark", box(0.42, 0.22, 0.3), T(0, 0.72, -0.12))
    m.add("body", "goat_fur", box(0.3, 0.1, 0.5), T(0, 0.43, 0))
    m.add("tail", "goat_dark", box(0.06, 0.14, 0.05), chain(T(0, 0.86, -0.38), Rx(-25)))
    for name, x, z in (("leg_fl", -0.13, 0.25), ("leg_fr", 0.13, 0.25), ("leg_bl", -0.13, -0.25), ("leg_br", 0.13, -0.25)):
        m.add(name, "goat_fur", box(0.09, 0.40, 0.09), T(x, 0.26, z))
        m.add(name, "hoof", box(0.1, 0.07, 0.1), T(x, 0.035, z))
    m.add("head", "goat_fur", box(0.12, 0.2, 0.12), chain(T(0, 0.86, 0.38), Rx(20)))
    m.add("head", "goat_fur", box(0.2, 0.22, 0.3), T(0, 0.98, 0.5))
    m.add("head", "goat_dark", box(0.21, 0.06, 0.12), T(0, 1.02, 0.6))
    m.add("head", "goat_dark", box(0.06, 0.12, 0.06), T(0, 0.84, 0.6))
    m.add("head", "pink", box(0.14, 0.08, 0.04), T(0, 0.92, 0.66))
    for side in (-1, 1):
        m.add("head", "eye", box(0.035, 0.04, 0.02), T(0.075 * side, 1.02, 0.655))
        m.add("head", "goat_fur", box(0.14, 0.05, 0.08), chain(T(0.15 * side, 1.02, 0.46), Rz(-25 * side)))
        m.add("head", "horn", box(0.04, 0.16, 0.05), chain(T(0.06 * side, 1.12, 0.44), Rx(-40), Rz(-10 * side)))
    m.write()


def make_pig():
    m = Model("pig")
    m.add("body", "pig_pink", blob(0.28, 9, 6, 0.0), chain(T(0, 0.47, -0.02), S(1.0, 0.86, 1.45)))
    for name, x, z in (("leg_fl", -0.15, 0.24), ("leg_fr", 0.15, 0.24), ("leg_bl", -0.15, -0.26), ("leg_br", 0.15, -0.26)):
        m.add(name, "pig_pink", box(0.11, 0.26, 0.11), T(x, 0.15, z))
        m.add(name, "hoof", box(0.115, 0.05, 0.115), T(x, 0.025, z))
    m.add("head", "pig_pink", blob(0.2, 8, 6, 0.0), chain(T(0, 0.56, 0.4), S(1.0, 0.92, 0.9)))
    m.add("head", "pig_snout", cylinder(0.085, 0.085, 0.07, seg=10), chain(T(0, 0.52, 0.56), Rx(90)))
    for side in (-1, 1):
        m.add("head", "eye", box(0.035, 0.04, 0.02), T(0.08 * side, 0.62, 0.565))
        m.add("head", "hoof", box(0.022, 0.035, 0.01), T(0.032 * side, 0.52, 0.632))
        m.add("head", "pig_snout", box(0.1, 0.12, 0.03, top_scale=(0.3, 1.0)), chain(T(0.11 * side, 0.74, 0.37), Rx(30), Rz(-20 * side)))
    for k in range(4):
        a = k * 1.4
        m.add("tail", "pig_snout", box(0.03, 0.03, 0.05), chain(T(0, 0.58 + 0.025 * math.sin(a), -0.44 - 0.012 * k), Rx(math.degrees(a))))
    m.write()


# ---------------------------------------------------------------------------
# fish and fishing gear
# ---------------------------------------------------------------------------


def fish_model(name, length, height, body, belly, fin, pattern=None, pattern_mat="fish_dark"):
    """Side-view fish lying along X (head toward +X), its flank facing +Z."""
    m = Model(name)
    L, H = length, height
    m.add("fish", body, sphere(0.5, 14, 9), S(L, H, H * 0.48))
    m.add("fish", belly, sphere(0.5, 12, 6), chain(T(0.02 * L, -0.16 * H, 0), S(L * 0.88, H * 0.55, H * 0.44)))
    m.add("fish", fin, blade(H * 0.62, L * 0.3, 1.7), chain(T(-L * 0.44, 0, 0), Rz(90)))
    m.add("fish", fin, blade(L * 0.34, H * 0.36, 0.35), chain(T(-0.04 * L, H * 0.4, 0)))
    m.add("fish", fin, blade(L * 0.16, H * 0.26, 0.3), chain(T(-0.2 * L, -H * 0.38, 0), Rz(180)))
    for side in (-1, 1):
        m.add("fish", "eye", sphere(H * 0.07, 6, 4), T(L * 0.36, H * 0.1, side * H * 0.19))
        m.add("fish", "fish_belly", sphere(H * 0.11, 6, 4), chain(T(L * 0.355, H * 0.1, side * H * 0.17), S(1, 1, 0.5)))
        m.add("fish", fin, blade(H * 0.2, H * 0.32, 0.4), chain(T(L * 0.18, -H * 0.12, side * H * 0.2), Ry(90 * side), Rz(-110)))
    if pattern == "stripes":
        for k in range(5):
            x = L * (0.22 - 0.12 * k)
            for side in (-1, 1):
                m.add("fish", pattern_mat, box(L * 0.035, H * 0.62, 0.012),
                      T(x, H * 0.05, side * H * 0.235 * math.sqrt(max(0.15, 1 - (x / (L * 0.5)) ** 2))))
    elif pattern == "spots":
        rng = np.random.default_rng(len(name))
        for k in range(14):
            x = rng.uniform(-0.36, 0.3) * L
            y = rng.uniform(-0.12, 0.3) * H
            for side in (-1, 1):
                depth = H * 0.24 * math.sqrt(max(0.1, 1 - (x / (L * 0.5)) ** 2 - (y / (H * 0.5)) ** 2))
                m.add("fish", pattern_mat, box(H * 0.07, H * 0.07, 0.012), T(x, y, side * depth))
    elif pattern == "tucunare":
        for k in range(3):
            x = L * (0.15 - 0.18 * k)
            for side in (-1, 1):
                m.add("fish", pattern_mat, box(L * 0.05, H * 0.55, 0.012), T(x, H * 0.08, side * H * 0.235))
        for side in (-1, 1):
            m.add("fish", "fin_red", sphere(H * 0.09, 7, 4), chain(T(-L * 0.4, 0, side * H * 0.08), S(1, 1, 0.5)))
    m.write()


def make_fish():
    fish_model("fish_lambari", 0.5, 0.18, "fish_silver", "fish_belly", "fin_yellow")
    fish_model("fish_tilapia", 0.5, 0.26, "fish_tilapia", "fish_belly", "fish_tilapia", "stripes", "fish_traira")
    fish_model("fish_traira", 0.56, 0.16, "fish_traira", "goat_fur", "fish_traira", "spots")
    fish_model("fish_carpa", 0.54, 0.24, "fish_carp", "cheese", "fin_red")
    fish_model("fish_tucunare", 0.54, 0.22, "fish_tucunare", "fish_belly", "fin_yellow", "tucunare")
    fish_model("fish_pintado", 0.6, 0.16, "fish_pintado", "fish_belly", "fish_pintado", "spots")
    fish_model("fish_dourado", 0.58, 0.24, "fish_gold", "cheese", "fin_gold")

    m = Model("old_boot")
    m.add("item", "boot_leather", cylinder(0.11, 0.12, 0.34, seg=9), T(0, -0.12, 0))
    m.add("item", "boot_leather", box(0.24, 0.12, 0.38, top_scale=(1.0, 0.9)), T(0, -0.16, 0.1))
    m.add("item", "hoof", box(0.25, 0.04, 0.4), T(0, -0.235, 0.1))
    m.add("item", "leaf_dark", blade(0.06, 0.14, 0.0), chain(T(0.05, 0.2, 0), Rz(-20)))
    m.write()

    m = Model("message_bottle")
    m.add("item", "glass", cylinder(0.11, 0.11, 0.3, seg=10), T(0, -0.2, 0))
    m.add("item", "glass", cylinder(0.11, 0.04, 0.08, seg=10), T(0, 0.1, 0))
    m.add("item", "glass", cylinder(0.04, 0.04, 0.07, seg=8), T(0, 0.18, 0))
    m.add("item", "cork", cylinder(0.045, 0.04, 0.05, seg=8), T(0, 0.24, 0))
    m.add("item", "paper", box(0.12, 0.2, 0.012), T(0, -0.06, 0.112))
    m.add("item", "seal", box(0.05, 0.05, 0.014), T(0, -0.04, 0.12))
    m.write()

    m = Model("fishing_rod")
    m.add("item", "wood_dark", cylinder(0.03, 0.026, 0.3, seg=7), T(0, -0.15, 0))
    m.add("item", "bamboo", cylinder(0.022, 0.008, 1.25, seg=6), T(0, 0.15, 0))
    for k in range(3):
        m.add("item", "wood_dark", cylinder(0.026, 0.026, 0.02, seg=6, caps=False), T(0, 0.35 + 0.3 * k, 0))
    m.add("item", "metal", cylinder(0.06, 0.06, 0.05, seg=10), chain(T(0.05, 0.02, 0), Rz(90), T(0, -0.025, 0)))
    m.add("item", "metal_light", box(0.02, 0.07, 0.02), T(0.09, 0.02, 0.03))
    m.write()

    m = Model("bobber")
    m.add("bobber", "bobber_red", sphere(0.055, 9, 4), chain(T(0, 0.012, 0), S(1, 1.05, 1)))
    m.add("bobber", "trim_white", cylinder(0.055, 0.01, 0.06, seg=9), chain(T(0, 0.012, 0), Rx(180)))
    m.add("bobber", "bobber_red", box(0.012, 0.07, 0.012), T(0, 0.09, 0))
    m.write()

    m = Model("fishing_line")
    m.add("line", "line", box(0.008, 1.0, 0.008), T(0, 0.5, 0))
    m.write()


# ---------------------------------------------------------------------------
# production machines, shed, mailbox, order board, ipê
# ---------------------------------------------------------------------------


def make_machines():
    # cheese press: a wooden frame with a screw and a wheel (animated part)
    m = Model("cheese_press")
    m.add("frame", "wood", box(1.0, 0.55, 0.75, uv_scale=1.5), T(0, 0.275, 0))
    m.add("frame", "wood_dark", box(1.06, 0.06, 0.8), T(0, 0.56, 0))
    for side in (-1, 1):
        m.add("frame", "wood_dark", box(0.12, 1.05, 0.12), T(side * 0.42, 1.08, 0))
    m.add("frame", "wood_dark", box(1.0, 0.14, 0.16), T(0, 1.62, 0))
    m.add("frame", "wood_pale", cylinder(0.26, 0.26, 0.24, seg=12, uv_scale=1.5), T(0, 0.59, 0))
    m.add("frame", "cheese", cylinder(0.22, 0.22, 0.25, seg=12), T(0, 0.6, 0))
    m.add("frame", "wood", cylinder(0.25, 0.25, 0.07, seg=12), T(0, 0.86, 0))
    m.add("frame", "metal", cylinder(0.035, 0.035, 0.85, seg=8), T(0, 0.9, 0))
    m.add("wheel", "metal", cylinder(0.035, 0.035, 0.14, seg=8), T(0, 1.69, 0))
    for k in range(4):
        m.add("wheel", "metal_light", box(0.36, 0.035, 0.035), chain(T(0, 1.8, 0), Ry(45 * k)))
    m.add("wheel", "metal", cylinder(0.19, 0.19, 0.03, seg=12, caps=False), T(0, 1.785, 0))
    m.write()

    # jam pot: copper pot on a tripod with a stirring spoon (animated part)
    m = Model("jam_pot")
    for k in range(3):
        a = 120 * k
        m.add("frame", "metal", box(0.05, 0.75, 0.05), chain(Ry(a), T(0, 0, 0.38), Rx(-12), T(0, 0.375, 0)))
    m.add("frame", "metal", cylinder(0.42, 0.42, 0.04, seg=12, caps=False), T(0, 0.62, 0))
    m.add("frame", "copper", cylinder(0.3, 0.42, 0.42, seg=14), T(0, 0.38, 0))
    m.add("frame", "jam_strawberry", cylinder(0.4, 0.4, 0.01, seg=14), T(0, 0.79, 0))
    for side in (-1, 1):
        m.add("frame", "copper", box(0.12, 0.05, 0.05), T(side * 0.46, 0.74, 0))
    for k in range(3):
        m.add("frame", "trunk", cylinder(0.05, 0.05, 0.5, seg=6), chain(T(0, 0.06, 0), Ry(60 * k), Rz(90), T(0, -0.25, 0)))
    m.add("spoon", "wood_pale", box(0.04, 0.7, 0.04), chain(T(0.15, 0.95, 0), Rz(-18)))
    m.add("spoon", "wood_pale", box(0.1, 0.12, 0.03), chain(T(0.07, 0.64, 0), Rz(-18)))
    m.write()

    m = Model("fire")
    for k in range(3):
        m.add("fire", "trunk", cylinder(0.05, 0.05, 0.45, seg=6), chain(T(0, 0.05, 0), Ry(60 * k), Rz(90), T(0, -0.225, 0)))
    for i, (x, z, h) in enumerate([(0, 0, 0.32), (0.08, 0.05, 0.22), (-0.07, -0.04, 0.24)]):
        m.add("flame", "fire", cylinder(0.08, 0.0, h, seg=5), chain(T(x, 0.08, z), Ry(i * 30)))
    m.write()

    # loom with a swinging beater (animated part)
    m = Model("loom")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.add("frame", "wood_dark", box(0.09, 1.3, 0.09), T(sx * 0.6, 0.65, sz * 0.35))
        m.add("frame", "wood_dark", box(0.09, 0.09, 0.8), T(sx * 0.6, 1.28, 0))
        m.add("frame", "wood_dark", box(0.09, 0.09, 0.8), T(sx * 0.6, 0.35, 0))
    m.add("frame", "wood", box(1.25, 0.12, 0.12), T(0, 1.24, -0.3))
    m.add("frame", "wood", box(1.25, 0.14, 0.14), T(0, 0.62, 0.32))
    for k in range(13):
        x = -0.48 + k * 0.08
        m.add("frame", "wool", box(0.012, 0.62, 0.012), chain(T(x, 0.93, 0.0), Rx(-35)))
    m.add("frame", "fabric_blue", box(1.0, 0.03, 0.34), chain(T(0, 0.7, 0.17), Rx(-10)))
    m.add("frame", "fabric_red", box(1.0, 0.032, 0.06), chain(T(0, 0.71, 0.1), Rx(-10)))
    m.add("beater", "wood", box(1.1, 0.08, 0.06), T(0, 0.82, 0.12))
    for side in (-1, 1):
        m.add("beater", "wood", box(0.05, 0.5, 0.05), T(side * 0.52, 1.05, 0.12))
    m.add("frame", "wood", box(1.0, 0.08, 0.3), T(0, 0.45, 0.75))
    for side in (-1, 1):
        m.add("frame", "wood_dark", box(0.08, 0.42, 0.08), T(side * 0.42, 0.21, 0.75))
    m.write()

    # wood-fired clay oven
    m = Model("oven")
    m.add("base", "stone", box(1.3, 0.55, 1.2, uv_scale=1.2), T(0, 0.275, 0))
    m.add("base", "clay", jitter_faces(sphere(0.58, 12, 8, uv_scale=1.5), 0.015, 4), chain(T(0, 0.55, -0.02), S(1.0, 0.85, 1.0)))
    m.add("base", "soot", box(0.42, 0.34, 0.08, top_scale=(0.7, 1.0)), T(0, 0.72, 0.55))
    m.add("base", "clay", box(0.56, 0.08, 0.14), T(0, 0.93, 0.52))
    m.add("base", "clay", cylinder(0.1, 0.08, 0.35, seg=8), T(0.2, 0.95, -0.25))
    m.add("base", "wood_dark", box(0.8, 0.05, 0.3), T(0, 0.58, 0.72))
    m.write()

    m = Model("oven_fire")
    m.add("glow", "fire", box(0.36, 0.24, 0.04, top_scale=(0.6, 1.0)), T(0, 0.68, 0.58))
    m.write()

    # beehive: painted boxes on a stand with a small roof
    m = Model("beehive")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.add("hive", "wood_dark", box(0.06, 0.3, 0.06), T(sx * 0.24, 0.15, sz * 0.2))
    m.add("hive", "wood", box(0.66, 0.05, 0.56), T(0, 0.32, 0))
    for k in range(3):
        m.add("hive", "hive_paint", box(0.56, 0.22, 0.48, uv_scale=1.5), T(0, 0.46 + 0.235 * k, 0))
        m.add("hive", "wood_dark", box(0.58, 0.02, 0.5), T(0, 0.575 + 0.235 * k, 0))
    m.add("hive", "soot", box(0.24, 0.04, 0.02), T(0, 0.38, 0.245))
    m.add("hive", "roof_red", prism(0.72, 0.62, 0.18, uv_scale=1.0), T(0, 1.15, 0))
    m.write()

    # open shed (galpão) sheltering the machines
    m = Model("shed")
    w, d, h = 11.0, 3.4, 2.4
    for i in range(5):
        x = -w / 2 + 0.2 + i * (w - 0.4) / 4
        for sz in (-1, 1):
            m.add("frame", "wood_dark", box(0.18, h, 0.18, uv_scale=1.5), T(x, h / 2, sz * (d / 2 - 0.1)))
    for sz in (-1, 1):
        m.add("frame", "wood_dark", box(w, 0.16, 0.16), T(0, h, sz * (d / 2 - 0.1)))
    angle = math.degrees(math.atan2(0.9, d / 2))
    slope = math.hypot(d / 2 + 0.4, 0.9 + 0.2)
    for side in (-1, 1):
        m.add("roof", "roof_red", box(w + 0.6, 0.12, slope, uv_scale=0.8),
              chain(T(0, h + 0.9, 0), Rx(angle * side), T(0, 0.06, side * slope / 2)))
    m.add("roof", "roof_red", box(w + 0.62, 0.12, 0.2), T(0, h + 0.96, 0))
    for side in (-1, 1):
        m.add("frame", "wood_dark", prism(0.1, d - 0.2, 0.86, uv_scale=1.0), T(side * (w / 2 - 0.05), h, 0))
    m.write()


def make_village_props():
    # mailbox with a flag that rises when a letter arrives (part "flag")
    m = Model("mailbox")
    m.add("post", "wood_dark", box(0.1, 1.05, 0.1), T(0, 0.525, 0))
    m.add("box", "mailbox", box(0.3, 0.2, 0.46), T(0, 1.15, 0.04))
    m.add("box", "mailbox", cylinder(0.15, 0.15, 0.46, seg=10), chain(T(0, 1.25, 0.27), Rx(-90)))
    m.add("box", "metal", box(0.26, 0.24, 0.02), T(0, 1.18, 0.28))
    m.add("flag", "metal", box(0.025, 0.28, 0.025), T(0.17, 1.27, -0.05))
    m.add("flag", "awning_red", box(0.02, 0.1, 0.14), T(0.17, 1.36, 0.02))
    m.write()

    # village order board (mural)
    m = Model("order_board")
    for side in (-1, 1):
        m.add("frame", "wood_dark", box(0.12, 2.0, 0.12, uv_scale=1.5), T(side * 0.9, 1.0, 0))
    m.add("frame", "wood", box(1.7, 1.0, 0.08, uv_scale=1.2), T(0, 1.35, 0))
    m.add("frame", "wood_dark", box(1.78, 0.08, 0.12), T(0, 1.88, 0))
    m.add("frame", "wood_dark", box(1.78, 0.08, 0.12), T(0, 0.82, 0))
    m.add("frame", "roof_brown", prism(2.1, 0.5, 0.32, uv_scale=1.0), T(0, 2.0, 0))
    papers = [(-0.5, 1.45, 0.34, 0.42, 4), (0.05, 1.32, 0.38, 0.5, -3), (0.55, 1.5, 0.32, 0.36, 6)]
    for i, (x, y, w, h, rot) in enumerate(papers):
        m.add("papers", "paper", box(w, h, 0.012), chain(T(x, y, 0.05), Rz(rot)))
        m.add("papers", "seal", box(0.05, 0.05, 0.02), T(x, y + h / 2 - 0.05, 0.065))
        for k in range(3):
            m.add("papers", "potato_eye", box(w * 0.7, 0.018, 0.004), chain(T(x, y + 0.06 - k * 0.08, 0.058), Rz(rot)))
    m.write()

    # golden ipê by the lake: bare branches and the blooming version
    def ipe(name, blooming):
        mm = Model(name)
        mm.add("trunk", "trunk", cylinder(0.2, 0.13, 2.2, seg=8, uv_scale=1.5), None)
        rng = np.random.default_rng(31)
        tips = []
        for i in range(6):
            ang = 60 * i + rng.uniform(-15, 15)
            tilt = rng.uniform(30, 52)
            ln = rng.uniform(1.1, 1.6)
            base = chain(T(0, 1.8 + rng.uniform(-0.2, 0.3), 0), Ry(ang), Rz(-tilt))
            mm.add("trunk", "trunk", cylinder(0.08, 0.035, ln, seg=6, uv_scale=1.5), base)
            tip = (base @ np.array([0, ln, 0, 1]))[:3]
            tips.append(tip)
            for k in range(2):
                twig = chain(base, T(0, ln * (0.55 + 0.3 * k), 0), Ry(90 + 160 * k), Rz(-35))
                mm.add("trunk", "trunk", cylinder(0.03, 0.01, 0.55, seg=5), twig)
                tips.append((twig @ np.array([0, 0.5, 0, 1]))[:3])
        if blooming:
            for i, tip in enumerate(tips):
                r = 0.42 + 0.12 * ((i * 7) % 3)
                mm.add("crown", "ipe_yellow" if i % 3 else "ipe_yellow_dark", blob(r, 8, 6, 0.08, 50 + i),
                       T(tip[0], tip[1] + 0.1, tip[2]))
            mm.add("crown", "ipe_yellow", blob(0.8, 9, 6, 0.1, 99), T(0, 3.05, 0))
        mm.write()

    ipe("ipe_bare", False)
    ipe("ipe_bloom", True)


# ---------------------------------------------------------------------------
# items and icons
# ---------------------------------------------------------------------------


def jar(name, content, lid="awning_red", extra=None):
    m = Model(name)
    m.add("item", content, cylinder(0.15, 0.15, 0.3, seg=12), T(0, -0.2, 0))
    m.add("item", "glass", cylinder(0.15, 0.12, 0.05, seg=12), T(0, 0.1, 0))
    m.add("item", lid, cylinder(0.17, 0.15, 0.06, seg=12), T(0, 0.14, 0))
    m.add("item", "paper", box(0.18, 0.12, 0.02), T(0, -0.07, 0.15))
    if extra:
        extra(m)
    m.write()


def make_goods():
    m = Model("mango")
    m.add("fruit", "mango", blob(0.085, 8, 6, 0.0), chain(T(0, -0.1, 0), S(0.85, 1.25, 0.8)))
    m.add("fruit", "mango_red", blob(0.06, 6, 4, 0.0), chain(T(0, -0.06, 0.03), S(0.9, 1.1, 0.7)))
    m.add("fruit", "stem", box(0.02, 0.06, 0.02), T(0, 0.0, 0))
    m.write()
    m = Model("mango_item")
    m.add("item", "mango", blob(0.2, 10, 7, 0.0), chain(Rz(-25), S(0.82, 1.22, 0.8)))
    m.add("item", "mango_red", blob(0.15, 8, 5, 0.0), chain(T(0.04, 0.06, 0.06), Rz(-25), S(0.85, 1.1, 0.7)))
    m.add("item", "stem", box(0.03, 0.08, 0.03), chain(T(0.1, 0.24, 0), Rz(-25)))
    m.add("item", "leaf", quad_xy(0.12, 0.07), chain(T(0.12, 0.26, 0), Rz(-50), Rx(-60)))
    m.write()

    m = Model("duck_egg")
    m.add("item", "duck_egg", blob(0.18, 10, 7, 0.0), S(1.0, 1.32, 1.0))
    m.write()

    m = Model("goat_milk")
    m.add("item", "milk", cylinder(0.14, 0.14, 0.32, seg=10), T(0, -0.25, 0))
    m.add("item", "milk", cylinder(0.14, 0.06, 0.1, seg=10), T(0, 0.07, 0))
    m.add("item", "cap_green", cylinder(0.065, 0.065, 0.06, seg=10), T(0, 0.17, 0))
    m.add("item", "cap_green", cylinder(0.142, 0.142, 0.1, seg=10, caps=False), T(0, -0.12, 0))
    m.write()

    m = Model("truffle")
    m.add("item", "truffle", jitter_faces(sphere(0.2, 9, 6), 0.035, 3), S(1.1, 0.85, 1.0))
    m.add("item", "truffle", jitter_faces(sphere(0.1, 6, 4), 0.02, 4), T(0.17, -0.05, 0.05))
    m.write()

    m = Model("cheese_wheel")
    m.add("item", "cheese_rind", cylinder(0.24, 0.24, 0.16, seg=14), T(0, -0.12, 0))
    m.add("item", "cheese", cylinder(0.22, 0.22, 0.012, seg=14), T(0, 0.04, 0))
    m.add("item", "cheese", prism(0.18, 0.12, 0.14, uv_scale=1.0), chain(T(0.12, 0.05, 0.12), Ry(35)))
    m.write()

    m = Model("goat_cheese")
    m.add("item", "goat_cheese", cylinder(0.11, 0.11, 0.42, seg=12), chain(Rz(90), T(0, -0.21, 0)))
    rng = np.random.default_rng(8)
    for k in range(12):
        a = rng.uniform(0, 2 * math.pi)
        x = rng.uniform(-0.18, 0.18)
        m.add("item", "herb", box(0.025, 0.025, 0.01), chain(T(x, 0, 0), Rx(math.degrees(a)), T(0, 0.112, 0)))
    m.write()

    jar("jam_apple", "jam_apple")
    jar("jam_orange", "jam_orange", "cloth")
    jar("jam_strawberry", "jam_strawberry")
    jar("jam_mango", "jam_mango", "fabric_blue")
    jar("pumpkin_sweet", "jam_pumpkin", "cloth")

    def dipper(m):
        m.add("item", "wood_pale", box(0.03, 0.34, 0.03), chain(T(0.05, 0.25, 0), Rz(-20)))
        m.add("item", "wood_pale", cylinder(0.035, 0.035, 0.08, seg=8), chain(T(0.11, 0.38, 0), Rz(-20)))
    jar("honey", "honey", "trim_white", dipper)

    m = Model("cloth_roll")
    for i, mat in enumerate(["fabric_blue", "fabric_red", "wool"]):
        m.add("item", mat, box(0.42, 0.07, 0.3), chain(T(0.01 * i, -0.1 + 0.075 * i, 0), Ry(8 * (i - 1))))
    m.add("item", "fabric_red", cylinder(0.06, 0.06, 0.42, seg=8), chain(T(0, 0.13, 0.12), Rz(90), T(0, -0.21, 0)))
    m.write()

    m = Model("corn_cake")
    m.add("item", "cake", cylinder(0.24, 0.23, 0.16, seg=14), T(0, -0.1, 0))
    m.add("item", "cake_top", cylinder(0.23, 0.2, 0.03, seg=14), T(0, 0.06, 0))
    m.add("item", "wood_pale", cylinder(0.3, 0.3, 0.02, seg=14), T(0, -0.12, 0))
    m.write()

    m = Model("tapioca")
    m.add("item", "tapioca", half_disc(0.24, 0.05), chain(T(0, -0.04, -0.06), Rx(-8)))
    m.add("item", "cheese", half_disc(0.21, 0.03), chain(T(0, 0.0, -0.05), Rx(-8)))
    m.add("item", "tapioca", half_disc(0.24, 0.04), chain(T(0, 0.04, -0.06), Rx(-14)))
    m.write()

    m = Model("heart")
    for side in (-1, 1):
        m.add("item", "heart", sphere(0.12, 10, 7), T(side * 0.085, 0.05, 0))
    m.add("item", "heart", box(0.17, 0.17, 0.2), chain(T(0, -0.04, 0), Rz(45)))
    m.write()

    m = Model("star")
    m.add("item", "gold", star_prism(0.24, 0.1, 0.08))
    m.write()

    m = Model("check")
    m.add("item", "check", box(0.09, 0.2, 0.08), chain(T(-0.1, -0.02, 0), Rz(40)))
    m.add("item", "check", box(0.09, 0.38, 0.08), chain(T(0.07, 0.06, 0), Rz(-35)))
    m.write()

    m = Model("lock")
    m.add("item", "gold", box(0.3, 0.24, 0.12), T(0, -0.08, 0))
    m.add("item", "metal_light", box(0.05, 0.16, 0.05), T(-0.1, 0.1, 0))
    m.add("item", "metal_light", box(0.05, 0.16, 0.05), T(0.1, 0.1, 0))
    m.add("item", "metal_light", box(0.25, 0.05, 0.05), T(0, 0.19, 0))
    m.add("item", "soot", box(0.04, 0.08, 0.02), T(0, -0.09, 0.065))
    m.write()

    m = Model("letter")
    m.add("item", "paper", box(0.46, 0.3, 0.03), None)
    m.add("item", "paper", prism(0.46, 0.035, 0.16, uv_scale=1.0), chain(T(0, 0.15, 0.016), Rx(180), Rz(0)))
    m.add("item", "seal", cylinder(0.05, 0.05, 0.02, seg=10), chain(T(0, 0.01, 0.03), Rx(90)))
    m.write()

    m = Model("journal")
    m.add("item", "paper", box(0.34, 0.42, 0.08), T(0.01, 0, 0))
    m.add("item", "book", box(0.36, 0.44, 0.025), T(0, 0, 0.05))
    m.add("item", "book", box(0.36, 0.44, 0.025), T(0, 0, -0.05))
    m.add("item", "book", box(0.03, 0.44, 0.12), T(-0.18, 0, 0))
    m.add("item", "gold", box(0.16, 0.05, 0.012), T(0.02, 0.08, 0.066))
    m.add("item", "awning_red", box(0.03, 0.2, 0.01), T(0.1, -0.25, 0.06))
    m.write()

    m = Model("sun_icon")
    m.add("item", "gold", cylinder(0.16, 0.16, 0.06, seg=14), chain(Rx(90), T(0, -0.03, 0)))
    for k in range(8):
        m.add("item", "gold", box(0.05, 0.09, 0.04), chain(Rz(45 * k), T(0, 0.24, 0)))
    m.write()

    def cloud(m, mat, dy=0.0):
        for x, y, r in ((-0.13, 0.0, 0.12), (0.0, 0.06, 0.15), (0.14, 0.0, 0.11), (0.0, -0.04, 0.12)):
            m.add("item", mat, sphere(r, 9, 6), T(x, y + dy, 0))

    m = Model("cloud_icon")
    cloud(m, "cloud")
    m.write()

    m = Model("rain_icon")
    cloud(m, "cloud_dark", 0.1)
    for x in (-0.12, 0.0, 0.12):
        m.add("item", "raindrop", sphere(0.035, 6, 4), chain(T(x - 0.03, -0.16, 0.02), S(0.8, 1.6, 0.8)))
    m.write()


def build_all():
    for build in (make_lettuce, make_potato, make_strawberry, make_sunflower, make_cassava, make_watermelon,
                  make_duck, make_goat, make_pig, make_fish, make_machines, make_village_props, make_goods):
        build()
