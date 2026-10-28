#!/usr/bin/env python3
"""
Procedural low-poly model generator for "Sítio do Sol".

Every model is built from simple primitives (boxes, cylinders, cones,
spheres, prisms) and written as a Wavefront OBJ + MTL pair into
assets/models/. The game loads these files with its own OBJ/MTL parser.

Conventions:
  * Y is up, the model faces +Z, the origin sits on the ground (y = 0).
  * 1 unit = 1 farm tile.
  * Faces use counter-clockwise winding seen from outside.
  * Parts that the engine animates are written as separate OBJ objects
    ("o leg_l", "o blades", ...). Their pivots are configured in
    src/data/models.js.

Run:  python3 tools/generate_models.py
"""

import math
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "models")

# ---------------------------------------------------------------------------
# Material palette (Kd = diffuse, Ks = specular, Ns = shininess, map = texture)
# ---------------------------------------------------------------------------

MATERIALS = {
    # characters
    "skin": dict(kd=(0.98, 0.78, 0.62), ks=0.08, ns=12),
    "hair": dict(kd=(0.36, 0.22, 0.13), ks=0.05, ns=8),
    "shirt": dict(kd=(0.86, 0.30, 0.26), ks=0.05, ns=8),
    "overalls": dict(kd=(0.27, 0.45, 0.78), ks=0.10, ns=16),
    "boots": dict(kd=(0.38, 0.24, 0.14), ks=0.15, ns=20),
    "straw": dict(kd=(0.95, 0.80, 0.42), ks=0.05, ns=8),
    "hat_band": dict(kd=(0.80, 0.24, 0.22), ks=0.05, ns=8),
    "eye": dict(kd=(0.08, 0.07, 0.07), ks=0.60, ns=80),
    "white_fur": dict(kd=(0.97, 0.96, 0.93), ks=0.05, ns=8),
    "black_fur": dict(kd=(0.16, 0.15, 0.15), ks=0.05, ns=8),
    "pink": dict(kd=(0.96, 0.63, 0.64), ks=0.10, ns=16),
    "horn": dict(kd=(0.93, 0.88, 0.74), ks=0.20, ns=30),
    "hoof": dict(kd=(0.30, 0.25, 0.22), ks=0.10, ns=16),
    "bell": dict(kd=(0.98, 0.78, 0.20), ks=0.90, ns=90),
    "collar": dict(kd=(0.70, 0.18, 0.18), ks=0.05, ns=8),
    "comb": dict(kd=(0.90, 0.16, 0.14), ks=0.10, ns=16),
    "beak": dict(kd=(0.99, 0.70, 0.18), ks=0.10, ns=16),
    "wool": dict(kd=(0.98, 0.97, 0.94), ks=0.02, ns=4),
    "sheep_face": dict(kd=(0.25, 0.22, 0.21), ks=0.05, ns=8),
    # plants
    "leaf": dict(kd=(0.42, 0.72, 0.26), ks=0.08, ns=12),
    "leaf_dark": dict(kd=(0.25, 0.55, 0.20), ks=0.08, ns=12),
    "leaf_light": dict(kd=(0.60, 0.82, 0.32), ks=0.08, ns=12),
    "stalk": dict(kd=(0.52, 0.70, 0.28), ks=0.05, ns=8),
    "carrot": dict(kd=(0.98, 0.52, 0.12), ks=0.15, ns=24),
    "tomato": dict(kd=(0.90, 0.16, 0.12), ks=0.55, ns=60),
    "tomato_green": dict(kd=(0.55, 0.75, 0.25), ks=0.35, ns=40),
    "corn": dict(kd=(0.99, 0.84, 0.25), ks=0.20, ns=24),
    "husk": dict(kd=(0.70, 0.80, 0.38), ks=0.05, ns=8),
    "pumpkin": dict(kd=(0.98, 0.55, 0.12), ks=0.30, ns=30),
    "pumpkin_green": dict(kd=(0.45, 0.65, 0.22), ks=0.30, ns=30),
    "seed": dict(kd=(0.92, 0.85, 0.62), ks=0.05, ns=8),
    "soil_mound": dict(kd=(0.42, 0.28, 0.18), ks=0.02, ns=4),
    "trunk": dict(kd=(0.50, 0.33, 0.20), ks=0.05, ns=8, map="bark.ppm"),
    "crown": dict(kd=(0.38, 0.66, 0.24), ks=0.06, ns=10),
    "crown_dark": dict(kd=(0.22, 0.48, 0.22), ks=0.06, ns=10),
    "crown_autumn": dict(kd=(0.92, 0.55, 0.20), ks=0.06, ns=10),
    "pine": dict(kd=(0.18, 0.44, 0.30), ks=0.06, ns=10),
    "apple": dict(kd=(0.88, 0.14, 0.14), ks=0.70, ns=70),
    "orange": dict(kd=(0.99, 0.56, 0.10), ks=0.45, ns=50),
    "stem": dict(kd=(0.40, 0.27, 0.15), ks=0.05, ns=8),
    "petal_pink": dict(kd=(0.98, 0.50, 0.75), ks=0.15, ns=20),
    "petal_blue": dict(kd=(0.45, 0.55, 0.98), ks=0.15, ns=20),
    "petal_yellow": dict(kd=(0.99, 0.86, 0.25), ks=0.15, ns=20),
    "petal_white": dict(kd=(0.98, 0.97, 0.95), ks=0.15, ns=20),
    "flower_core": dict(kd=(0.99, 0.80, 0.20), ks=0.10, ns=16),
    "grass_blade": dict(kd=(0.45, 0.70, 0.25), ks=0.02, ns=6),
    "grass_tall": dict(kd=(0.55, 0.74, 0.30), ks=0.02, ns=6),
    "rock": dict(kd=(0.60, 0.60, 0.62), ks=0.10, ns=16, map="stone.ppm"),
    "hay": dict(kd=(0.95, 0.82, 0.45), ks=0.02, ns=4, map="hay.ppm"),
    # buildings and props
    "wood": dict(kd=(0.80, 0.62, 0.42), ks=0.05, ns=10, map="wood.ppm"),
    "wood_dark": dict(kd=(0.55, 0.38, 0.24), ks=0.05, ns=10, map="wood.ppm"),
    "wood_pale": dict(kd=(0.95, 0.88, 0.75), ks=0.05, ns=10, map="wood.ppm"),
    "wall_blue": dict(kd=(0.78, 0.86, 0.95), ks=0.05, ns=10, map="wood.ppm"),
    "wall_yellow": dict(kd=(0.99, 0.82, 0.40), ks=0.05, ns=10, map="wood.ppm"),
    "wall_white": dict(kd=(0.97, 0.95, 0.90), ks=0.05, ns=10, map="wood.ppm"),
    "roof_thatch": dict(kd=(0.92, 0.72, 0.40), ks=0.02, ns=6, map="thatch.ppm"),
    "roof_red": dict(kd=(0.82, 0.28, 0.22), ks=0.10, ns=14, map="roof.ppm"),
    "roof_brown": dict(kd=(0.62, 0.42, 0.30), ks=0.10, ns=14, map="roof.ppm"),
    "stone": dict(kd=(0.80, 0.78, 0.74), ks=0.08, ns=12, map="stone.ppm"),
    "trim_white": dict(kd=(0.98, 0.97, 0.95), ks=0.10, ns=16),
    "door": dict(kd=(0.60, 0.40, 0.25), ks=0.05, ns=10, map="wood.ppm"),
    "window_glow": dict(kd=(0.45, 0.62, 0.78), ks=0.90, ns=120, ke=(1.0, 0.78, 0.40)),
    "lantern_glow": dict(kd=(0.98, 0.90, 0.60), ks=0.50, ns=60, ke=(1.0, 0.80, 0.45)),
    "metal": dict(kd=(0.35, 0.36, 0.40), ks=0.80, ns=80),
    "metal_light": dict(kd=(0.70, 0.72, 0.76), ks=0.90, ns=90),
    "gold": dict(kd=(0.99, 0.80, 0.22), ks=0.95, ns=100),
    "awning_red": dict(kd=(0.88, 0.28, 0.25), ks=0.05, ns=8),
    "awning_white": dict(kd=(0.98, 0.96, 0.92), ks=0.05, ns=8),
    "water": dict(kd=(0.25, 0.50, 0.70), ks=1.0, ns=60),
    "sack": dict(kd=(0.88, 0.76, 0.56), ks=0.02, ns=6),
    "cloth": dict(kd=(0.55, 0.40, 0.70), ks=0.05, ns=8),
    "milk": dict(kd=(0.98, 0.98, 0.98), ks=0.50, ns=60),
    "cap_blue": dict(kd=(0.25, 0.48, 0.90), ks=0.40, ns=40),
    "egg": dict(kd=(0.99, 0.93, 0.82), ks=0.40, ns=40),
    "soil_tile": dict(kd=(1.0, 1.0, 1.0), ks=0.02, ns=4, map="soil.ppm"),
    "blade_metal": dict(kd=(0.62, 0.64, 0.68), ks=0.90, ns=90),
    "can_green": dict(kd=(0.35, 0.65, 0.55), ks=0.60, ns=60),
}

# ---------------------------------------------------------------------------
# Transform helpers (4x4 matrices)
# ---------------------------------------------------------------------------


def T(x=0.0, y=0.0, z=0.0):
    m = np.eye(4)
    m[:3, 3] = (x, y, z)
    return m


def S(x=1.0, y=None, z=None):
    if y is None:
        y = x
    if z is None:
        z = x
    return np.diag([x, y, z, 1.0])


def Rx(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    m = np.eye(4)
    m[1, 1], m[1, 2], m[2, 1], m[2, 2] = c, -s, s, c
    return m


def Ry(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    m = np.eye(4)
    m[0, 0], m[0, 2], m[2, 0], m[2, 2] = c, s, -s, c
    return m


def Rz(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    m = np.eye(4)
    m[0, 0], m[0, 1], m[1, 0], m[1, 1] = c, -s, s, c
    return m


def chain(*mats):
    """Compose matrices left-to-right as written: chain(A, B) = A @ B."""
    out = np.eye(4)
    for m in mats:
        out = out @ m
    return out


# ---------------------------------------------------------------------------
# Face representation: dict(p=[np.array(3)], uv=[(u,v)] or None)
# ---------------------------------------------------------------------------


def transform_faces(faces, m):
    out = []
    for f in faces:
        pts = []
        for p in f["p"]:
            v = m @ np.array([p[0], p[1], p[2], 1.0])
            pts.append(v[:3])
        nf = dict(p=pts, uv=f["uv"])
        # Mirroring transforms flip the winding; restore it.
        if np.linalg.det(m[:3, :3]) < 0:
            nf["p"] = pts[::-1]
            nf["uv"] = f["uv"][::-1] if f["uv"] else None
        out.append(nf)
    return out


def jitter_faces(faces, amount, seed=0):
    """Deterministic per-position noise so shared vertices stay welded."""

    def offset(p):
        key = (round(p[0], 4), round(p[1], 4), round(p[2], 4))
        h = hash((key, seed)) & 0xFFFFFFFF
        rng = np.random.default_rng(h)
        return rng.uniform(-amount, amount, 3)

    out = []
    for f in faces:
        out.append(dict(p=[p + offset(p) for p in f["p"]], uv=f["uv"]))
    return out


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------


def box(sx, sy, sz, uv_scale=1.0, top_scale=(1.0, 1.0), top_shift=(0.0, 0.0)):
    """Axis-aligned box centred on the origin. top_scale tapers the top face."""
    x0, x1 = -sx / 2, sx / 2
    y0, y1 = -sy / 2, sy / 2
    z0, z1 = -sz / 2, sz / 2
    tx, tz = top_scale
    ox, oz = top_shift

    def top(x, z):
        return np.array([x * tx + ox, y1, z * tz + oz])

    def bot(x, z):
        return np.array([x, y0, z])

    k = uv_scale
    faces = [
        # +Z
        dict(p=[bot(x0, z1), bot(x1, z1), top(x1, z1), top(x0, z1)],
             uv=[(0, 0), (sx * k, 0), (sx * k, sy * k), (0, sy * k)]),
        # -Z
        dict(p=[bot(x1, z0), bot(x0, z0), top(x0, z0), top(x1, z0)],
             uv=[(0, 0), (sx * k, 0), (sx * k, sy * k), (0, sy * k)]),
        # +X
        dict(p=[bot(x1, z1), bot(x1, z0), top(x1, z0), top(x1, z1)],
             uv=[(0, 0), (sz * k, 0), (sz * k, sy * k), (0, sy * k)]),
        # -X
        dict(p=[bot(x0, z0), bot(x0, z1), top(x0, z1), top(x0, z0)],
             uv=[(0, 0), (sz * k, 0), (sz * k, sy * k), (0, sy * k)]),
        # +Y
        dict(p=[top(x0, z1), top(x1, z1), top(x1, z0), top(x0, z0)],
             uv=[(0, 0), (sx * k, 0), (sx * k, sz * k), (0, sz * k)]),
        # -Y
        dict(p=[bot(x0, z0), bot(x1, z0), bot(x1, z1), bot(x0, z1)],
             uv=[(0, 0), (sx * k, 0), (sx * k, sz * k), (0, sz * k)]),
    ]
    return faces


def cylinder(r0, r1, h, seg=8, caps=True, uv_scale=1.0, angle_offset=0.0):
    """Cylinder/cone/frustum standing on y = 0 along +Y."""
    faces = []
    k = uv_scale
    circ = 2 * math.pi * max(r0, r1)

    def ring(r, y, a):
        return np.array([r * math.cos(a), y, -r * math.sin(a)])

    for i in range(seg):
        a0 = angle_offset + 2 * math.pi * i / seg
        a1 = angle_offset + 2 * math.pi * (i + 1) / seg
        u0 = circ * i / seg * k
        u1 = circ * (i + 1) / seg * k
        pts = [ring(r0, 0, a0), ring(r0, 0, a1), ring(r1, h, a1), ring(r1, h, a0)]
        uvs = [(u0, 0), (u1, 0), (u1, h * k), (u0, h * k)]
        if r1 < 1e-6:  # cone tip -> triangle
            pts = pts[:3]
            uvs = [(u0, 0), (u1, 0), ((u0 + u1) / 2, h * k)]
        elif r0 < 1e-6:
            pts = [pts[0], pts[2], pts[3]]
            uvs = [((u0 + u1) / 2, 0), (u1, h * k), (u0, h * k)]
        faces.append(dict(p=pts, uv=uvs))
    if caps:
        if r1 > 1e-6:
            pts = [ring(r1, h, angle_offset + 2 * math.pi * i / seg) for i in range(seg)]
            uvs = [((p[0] / r1 * 0.5 + 0.5) * r1 * 2 * k, (-p[2] / r1 * 0.5 + 0.5) * r1 * 2 * k) for p in pts]
            faces.append(dict(p=pts, uv=uvs))
        if r0 > 1e-6:
            pts = [ring(r0, 0, angle_offset + 2 * math.pi * i / seg) for i in range(seg)][::-1]
            uvs = [((p[0] / r0 * 0.5 + 0.5) * r0 * 2 * k, (p[2] / r0 * 0.5 + 0.5) * r0 * 2 * k) for p in pts]
            faces.append(dict(p=pts, uv=uvs))
    return faces


def sphere(r, seg_u=8, seg_v=6, uv_scale=1.0):
    """Low-poly UV sphere centred on the origin."""
    faces = []
    k = uv_scale

    def pt(i, j):
        lat = -math.pi / 2 + math.pi * j / seg_v
        lon = 2 * math.pi * i / seg_u
        return np.array([r * math.cos(lat) * math.cos(lon), r * math.sin(lat), -r * math.cos(lat) * math.sin(lon)])

    for j in range(seg_v):
        for i in range(seg_u):
            pts = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)]
            uvs = [(i / seg_u * k, j / seg_v * k), ((i + 1) / seg_u * k, j / seg_v * k),
                   ((i + 1) / seg_u * k, (j + 1) / seg_v * k), (i / seg_u * k, (j + 1) / seg_v * k)]
            # Collapse pole quads into triangles.
            clean_p, clean_uv = [], []
            for p, uv in zip(pts, uvs):
                if not clean_p or np.linalg.norm(p - clean_p[-1]) > 1e-7:
                    clean_p.append(p)
                    clean_uv.append(uv)
            if np.linalg.norm(clean_p[0] - clean_p[-1]) < 1e-7:
                clean_p.pop()
                clean_uv.pop()
            if len(clean_p) >= 3:
                faces.append(dict(p=clean_p, uv=clean_uv))
    return faces


def prism(w, d, h, uv_scale=1.0):
    """Triangular prism along X (a gable). Base on y = 0, ridge at y = h."""
    x0, x1 = -w / 2, w / 2
    z0, z1 = -d / 2, d / 2
    k = uv_scale
    a = np.array
    slope = math.hypot(d / 2, h)
    faces = [
        # front slope (+Z side)
        dict(p=[a([x0, 0, z1]), a([x1, 0, z1]), a([x1, h, 0]), a([x0, h, 0])],
             uv=[(0, 0), (w * k, 0), (w * k, slope * k), (0, slope * k)]),
        # back slope (-Z side)
        dict(p=[a([x1, 0, z0]), a([x0, 0, z0]), a([x0, h, 0]), a([x1, h, 0])],
             uv=[(0, 0), (w * k, 0), (w * k, slope * k), (0, slope * k)]),
        # +X gable
        dict(p=[a([x1, 0, z1]), a([x1, 0, z0]), a([x1, h, 0])],
             uv=[(0, 0), (d * k, 0), (d / 2 * k, h * k)]),
        # -X gable
        dict(p=[a([x0, 0, z0]), a([x0, 0, z1]), a([x0, h, 0])],
             uv=[(0, 0), (d * k, 0), (d / 2 * k, h * k)]),
    ]
    return faces


def quad_xy(w, h, uv_scale=1.0):
    """Double-sided flat quad facing +Z (used for leaves and blades)."""
    a = np.array
    front = dict(p=[a([-w / 2, 0, 0]), a([w / 2, 0, 0]), a([w / 2, h, 0]), a([-w / 2, h, 0])],
                 uv=[(0, 0), (w * uv_scale, 0), (w * uv_scale, h * uv_scale), (0, h * uv_scale)])
    back = dict(p=front["p"][::-1], uv=front["uv"][::-1])
    return [front, back]


def blade(w, h, tip=0.0):
    """Thin tapered blade (double sided triangle strip) facing +Z, base at origin."""
    a = np.array
    p = [a([-w / 2, 0, 0]), a([w / 2, 0, 0]), a([tip * w / 2, h, 0]), a([-tip * w / 2, h, 0])]
    if tip < 1e-6:
        front = dict(p=[p[0], p[1], a([0, h, 0])], uv=None)
    else:
        front = dict(p=p, uv=None)
    back = dict(p=front["p"][::-1], uv=None)
    return [front, back]


# ---------------------------------------------------------------------------
# Model container + writer
# ---------------------------------------------------------------------------


class Model:
    def __init__(self, name):
        self.name = name
        self.parts = []  # (object, material, faces)

    def add(self, obj, mat, faces, m=None):
        if m is not None:
            faces = transform_faces(faces, m)
        assert mat in MATERIALS, mat
        self.parts.append((obj, mat, faces))
        return self

    def write(self):
        os.makedirs(OUT_DIR, exist_ok=True)
        v_index, vt_index, vn_index = {}, {}, {}
        v_list, vt_list, vn_list = [], [], []

        def get(index, lst, key):
            if key not in index:
                index[key] = len(lst) + 1
                lst.append(key)
            return index[key]

        body = []
        used_mats = []
        last_obj = None
        for obj, mat, faces in self.parts:
            if obj != last_obj:
                body.append(f"o {obj}")
                last_obj = obj
                last_mat = None
            if mat != last_mat:
                body.append(f"usemtl {mat}")
                last_mat = mat
            if mat not in used_mats:
                used_mats.append(mat)
            has_map = "map" in MATERIALS[mat]
            for f in faces:
                pts = f["p"]
                n = newell_normal(pts)
                if n is None:
                    continue
                ni = get(vn_index, vn_list, tuple(round(c, 4) for c in n))
                refs = []
                for idx, p in enumerate(pts):
                    vi = get(v_index, v_list, tuple(round(c, 4) for c in p))
                    if has_map and f["uv"]:
                        uv = f["uv"][idx]
                        ti = get(vt_index, vt_list, (round(uv[0], 4), round(uv[1], 4)))
                        refs.append(f"{vi}/{ti}/{ni}")
                    else:
                        refs.append(f"{vi}//{ni}")
                body.append("f " + " ".join(refs))

        lines = [
            f"# Sítio do Sol - {self.name}",
            "# Generated by tools/generate_models.py (procedural low-poly)",
            f"mtllib {self.name}.mtl",
        ]
        lines += [f"v {x:.4f} {y:.4f} {z:.4f}" for x, y, z in v_list]
        lines += [f"vt {u:.4f} {v:.4f}" for u, v in vt_list]
        lines += [f"vn {x:.4f} {y:.4f} {z:.4f}" for x, y, z in vn_list]
        lines += body
        with open(os.path.join(OUT_DIR, f"{self.name}.obj"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")

        mtl = [f"# Sítio do Sol - materials for {self.name}"]
        for mat in used_mats:
            spec = MATERIALS[mat]
            kd = spec["kd"]
            ks = spec.get("ks", 0.1)
            mtl.append(f"newmtl {mat}")
            mtl.append(f"Ka {kd[0]:.3f} {kd[1]:.3f} {kd[2]:.3f}")
            mtl.append(f"Kd {kd[0]:.3f} {kd[1]:.3f} {kd[2]:.3f}")
            mtl.append(f"Ks {ks:.3f} {ks:.3f} {ks:.3f}")
            mtl.append(f"Ns {spec.get('ns', 10):.1f}")
            if "ke" in spec:
                ke = spec["ke"]
                mtl.append(f"Ke {ke[0]:.3f} {ke[1]:.3f} {ke[2]:.3f}")
            mtl.append("d 1.0")
            mtl.append("illum 2")
            if "map" in spec:
                mtl.append(f"map_Kd ../textures/{spec['map']}")
            mtl.append("")
        with open(os.path.join(OUT_DIR, f"{self.name}.mtl"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(mtl))
        return len(v_list)


def newell_normal(pts):
    n = np.zeros(3)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        n[0] += (a[1] - b[1]) * (a[2] + b[2])
        n[1] += (a[2] - b[2]) * (a[0] + b[0])
        n[2] += (a[0] - b[0]) * (a[1] + b[1])
    length = np.linalg.norm(n)
    if length < 1e-10:
        return None
    return n / length


# ---------------------------------------------------------------------------
# Small reusable shapes
# ---------------------------------------------------------------------------


def leaf_fan(model, obj, mat, count, length, width, tilt, y=0.0, twist=0.0, tip=0.0, radius=0.0, seed=0):
    """Ring of blades leaning outward (rosettes, sprouts, grass)."""
    rng = np.random.default_rng(seed)
    for i in range(count):
        angle = 360.0 * i / count + twist + rng.uniform(-12, 12)
        ln = length * rng.uniform(0.8, 1.15)
        tl = tilt + rng.uniform(-8, 8)
        m = chain(T(0, y, 0), Ry(angle), T(0, 0, radius), Rx(tl))
        model.add(obj, mat, blade(width, ln, tip), m)


def blob(r, seg_u=7, seg_v=5, jitter=0.0, seed=0):
    faces = sphere(r, seg_u, seg_v)
    if jitter > 0:
        faces = jitter_faces(faces, jitter, seed)
    return faces


# ---------------------------------------------------------------------------
# Characters and animals
# ---------------------------------------------------------------------------


def make_farmer():
    m = Model("farmer")
    # legs (pivot at hip y = 0.52)
    for side, name in ((-1, "leg_l"), (1, "leg_r")):
        x = 0.095 * side
        m.add(name, "overalls", box(0.15, 0.44, 0.17), T(x, 0.30, 0))
        m.add(name, "boots", box(0.17, 0.10, 0.24), T(x, 0.05, 0.03))
    # torso
    m.add("body", "shirt", box(0.40, 0.30, 0.25), T(0, 0.82, 0))
    m.add("body", "overalls", box(0.42, 0.24, 0.27), T(0, 0.62, 0))
    m.add("body", "overalls", box(0.26, 0.16, 0.03), T(0, 0.80, 0.135))
    for side in (-1, 1):
        m.add("body", "overalls", box(0.05, 0.22, 0.03), T(0.10 * side, 0.86, 0.13))
        m.add("body", "overalls", box(0.05, 0.22, 0.03), T(0.10 * side, 0.86, -0.13))
        m.add("body", "gold", box(0.04, 0.04, 0.02), T(0.10 * side, 0.86, 0.15))
    # arms (pivot at shoulder y = 0.94)
    for side, name in ((-1, "arm_l"), (1, "arm_r")):
        x = 0.26 * side
        m.add(name, "shirt", box(0.12, 0.30, 0.13), T(x, 0.80, 0))
        m.add(name, "skin", box(0.11, 0.10, 0.11), T(x, 0.61, 0))
    # head (pivot at neck y = 0.97)
    m.add("head", "skin", box(0.32, 0.30, 0.29), T(0, 1.12, 0))
    m.add("head", "hair", box(0.34, 0.12, 0.31), T(0, 1.25, -0.01))
    m.add("head", "hair", box(0.34, 0.20, 0.06), T(0, 1.15, -0.14))
    for side in (-1, 1):
        m.add("head", "eye", box(0.045, 0.06, 0.02), T(0.075 * side, 1.12, 0.148))
        m.add("head", "pink", box(0.05, 0.03, 0.01), T(0.11 * side, 1.06, 0.147))
    m.add("head", "skin", box(0.06, 0.05, 0.05), T(0, 1.08, 0.16))
    # straw hat
    m.add("head", "straw", cylinder(0.33, 0.31, 0.035, seg=12), T(0, 1.27, 0))
    m.add("head", "straw", cylinder(0.18, 0.15, 0.14, seg=10), T(0, 1.30, 0))
    m.add("head", "hat_band", cylinder(0.185, 0.18, 0.04, seg=10, caps=False), T(0, 1.305, 0))
    m.write()


def make_chicken():
    m = Model("chicken")
    m.add("body", "white_fur", blob(0.16, 8, 6, 0.012, 1), chain(T(0, 0.24, -0.02), S(1.0, 0.9, 1.25)))
    m.add("body", "white_fur", box(0.12, 0.14, 0.08, top_scale=(0.6, 0.5)), chain(T(0, 0.33, -0.20), Rx(-30)))
    for side, name in ((-1, "wing_l"), (1, "wing_r")):
        m.add(name, "white_fur", box(0.04, 0.12, 0.20), T(0.16 * side, 0.25, -0.03))
    # head (pivot near neck)
    m.add("head", "white_fur", box(0.13, 0.15, 0.13), T(0, 0.41, 0.13))
    m.add("head", "comb", box(0.03, 0.06, 0.09), T(0, 0.51, 0.13))
    m.add("head", "comb", box(0.03, 0.05, 0.03), T(0, 0.33, 0.20))
    m.add("head", "beak", cylinder(0.035, 0.0, 0.07, seg=4), chain(T(0, 0.40, 0.19), Rx(90)))
    for side in (-1, 1):
        m.add("head", "eye", box(0.02, 0.03, 0.03), T(0.066 * side, 0.43, 0.16))
    for side, name in ((-1, "leg_l"), (1, "leg_r")):
        m.add(name, "beak", box(0.025, 0.13, 0.025), T(0.05 * side, 0.075, 0))
        m.add(name, "beak", box(0.06, 0.015, 0.08), T(0.05 * side, 0.008, 0.02))
    m.write()


def make_cow():
    m = Model("cow")
    m.add("body", "white_fur", box(0.62, 0.50, 1.00), T(0, 0.74, 0))
    spots = [(0.312, 0.80, 0.15, 0.30, 0.25), (0.312, 0.68, -0.25, 0.22, 0.18), (-0.312, 0.78, -0.05, 0.28, 0.30),
             (-0.312, 0.66, 0.30, 0.18, 0.16)]
    for x, y, z, w, h in spots:
        m.add("body", "black_fur", box(0.02, h, w), T(x, y, z))
    m.add("body", "black_fur", box(0.30, 0.02, 0.32), T(0.05, 0.995, -0.10))
    m.add("body", "pink", box(0.22, 0.08, 0.22), T(0, 0.46, -0.18))
    # tail
    m.add("tail", "white_fur", box(0.05, 0.40, 0.05), chain(T(0, 0.78, -0.52), Rx(12)))
    m.add("tail", "black_fur", box(0.08, 0.10, 0.08), T(0, 0.58, -0.55))
    # legs (pivot at top y = 0.55)
    for name, x, z in (("leg_fl", -0.20, 0.36), ("leg_fr", 0.20, 0.36), ("leg_bl", -0.20, -0.36), ("leg_br", 0.20, -0.36)):
        m.add(name, "white_fur", box(0.15, 0.44, 0.15), T(x, 0.33, z))
        m.add(name, "hoof", box(0.16, 0.10, 0.16), T(x, 0.05, z))
    # head (pivot at neck)
    m.add("head", "white_fur", box(0.38, 0.36, 0.36), T(0, 0.98, 0.62))
    m.add("head", "black_fur", box(0.20, 0.12, 0.02), T(-0.05, 1.10, 0.805))
    m.add("head", "pink", box(0.34, 0.16, 0.12), T(0, 0.88, 0.84))
    for side in (-1, 1):
        m.add("head", "eye", box(0.05, 0.06, 0.02), T(0.10 * side, 1.02, 0.805))
        m.add("head", "black_fur", box(0.02, 0.03, 0.02), T(0.07 * side, 0.89, 0.905))
        m.add("head", "white_fur", box(0.16, 0.06, 0.10), T(0.25 * side, 1.08, 0.58))
        m.add("head", "horn", box(0.05, 0.14, 0.05), chain(T(0.13 * side, 1.20, 0.58), Rz(-15 * side)))
    m.add("head", "collar", box(0.40, 0.06, 0.06), T(0, 0.80, 0.50))
    m.add("head", "bell", cylinder(0.06, 0.045, 0.10, seg=8), T(0, 0.66, 0.56))
    m.write()


def make_sheep():
    m = Model("sheep")
    rng = np.random.default_rng(7)
    centers = [(0, 0.62, 0), (0.12, 0.66, 0.18), (-0.12, 0.66, 0.18), (0.12, 0.66, -0.2), (-0.12, 0.66, -0.2),
               (0, 0.78, 0.0), (0, 0.6, 0.3), (0, 0.6, -0.32)]
    for i, (x, y, z) in enumerate(centers):
        r = rng.uniform(0.22, 0.28)
        m.add("body", "wool", blob(r, 7, 5, 0.025, i), T(x, y, z))
    for name, x, z in (("leg_fl", -0.14, 0.24), ("leg_fr", 0.14, 0.24), ("leg_bl", -0.14, -0.24), ("leg_br", 0.14, -0.24)):
        m.add(name, "sheep_face", box(0.10, 0.42, 0.10), T(x, 0.21, z))
    m.add("head", "sheep_face", box(0.24, 0.26, 0.28), T(0, 0.78, 0.46))
    m.add("head", "wool", blob(0.14, 6, 4, 0.02, 33), T(0, 0.93, 0.42))
    for side in (-1, 1):
        m.add("head", "eye", box(0.04, 0.05, 0.02), T(0.07 * side, 0.82, 0.60))
        m.add("head", "sheep_face", box(0.14, 0.06, 0.08), chain(T(0.17 * side, 0.84, 0.40), Rz(-20 * side)))
    m.write()


# ---------------------------------------------------------------------------
# Crops (5 growth stages each)
# ---------------------------------------------------------------------------


def seeds_stage(name, color="seed"):
    m = Model(f"{name}_0")
    m.add("plant", "soil_mound", box(0.36, 0.06, 0.36, top_scale=(0.7, 0.7)), T(0, 0.03, 0))
    rng = np.random.default_rng(len(name))
    for i in range(5):
        x, z = rng.uniform(-0.12, 0.12, 2)
        m.add("plant", color, box(0.035, 0.03, 0.05), chain(T(x, 0.07, z), Ry(rng.uniform(0, 180))))
    m.write()


def sprout_stage(name, mat="leaf_light"):
    m = Model(f"{name}_1")
    m.add("plant", "soil_mound", box(0.30, 0.05, 0.30, top_scale=(0.7, 0.7)), T(0, 0.025, 0))
    m.add("plant", "stalk", box(0.02, 0.10, 0.02), T(0, 0.08, 0))
    for side in (-1, 1):
        m.add("plant", mat, quad_xy(0.09, 0.05), chain(T(0.045 * side, 0.12, 0), Rz(-25 * side), Rx(-90)))
    m.write()


def make_carrot():
    seeds_stage("carrot")
    sprout_stage("carrot")
    m = Model("carrot_2")
    leaf_fan(m, "plant", "leaf", 5, 0.18, 0.06, 25, y=0.0, seed=1)
    m.write()
    m = Model("carrot_3")
    leaf_fan(m, "plant", "leaf", 7, 0.30, 0.08, 28, y=0.0, seed=2)
    leaf_fan(m, "plant", "leaf_dark", 5, 0.22, 0.07, 15, y=0.0, twist=30, seed=3)
    m.write()
    m = Model("carrot_4")
    leaf_fan(m, "plant", "leaf", 8, 0.38, 0.09, 30, y=0.06, seed=4)
    leaf_fan(m, "plant", "leaf_dark", 6, 0.30, 0.08, 15, y=0.06, twist=30, seed=5)
    m.add("plant", "carrot", cylinder(0.075, 0.055, 0.09, seg=7), T(0, 0.0, 0))
    m.write()
    # harvested item / icon
    m = Model("carrot_item")
    m.add("item", "carrot", cylinder(0.0, 0.10, 0.42, seg=8, caps=True), chain(T(0, -0.21, 0)))
    leaf_fan(m, "item", "leaf", 5, 0.20, 0.07, 18, y=0.2, seed=6)
    m.write()


def make_tomato():
    seeds_stage("tomato")
    sprout_stage("tomato", "leaf")
    for stage, height, n_fruit, fruit_mat in ((2, 0.30, 0, None), (3, 0.55, 3, "tomato_green"), (4, 0.62, 6, "tomato")):
        m = Model(f"tomato_{stage}")
        if stage >= 3:
            m.add("plant", "wood", box(0.04, height + 0.15, 0.04), T(0.06, (height + 0.15) / 2, -0.05))
        m.add("plant", "stalk", box(0.03, height, 0.03), T(0, height / 2, 0))
        rng = np.random.default_rng(stage)
        for i in range(4 + stage * 2):
            y = rng.uniform(0.25, 1.0) * height
            r = 0.08 + 0.03 * stage * (1.1 - y / height)
            x, z = rng.uniform(-0.08, 0.08, 2)
            m.add("plant", "leaf" if i % 2 else "leaf_dark", blob(r, 6, 4, 0.02, i + stage * 10), T(x, y, z))
        for i in range(n_fruit):
            a = 2 * math.pi * i / max(n_fruit, 1) + 0.4
            y = height * (0.35 + 0.45 * ((i * 37) % 10) / 10)
            m.add("plant", fruit_mat, blob(0.055, 7, 5, 0.0), T(math.cos(a) * 0.15, y, math.sin(a) * 0.15))
        m.write()
    m = Model("tomato_item")
    m.add("item", "tomato", blob(0.2, 10, 7, 0.0), S(1.0, 0.85, 1.0))
    for i in range(5):
        m.add("item", "leaf_dark", box(0.035, 0.015, 0.12), chain(T(0, 0.17, 0), Ry(72 * i), T(0, 0, 0.05)))
    m.add("item", "stem", box(0.03, 0.06, 0.03), T(0, 0.2, 0))
    m.write()


def make_corn():
    seeds_stage("corn", "corn")
    sprout_stage("corn", "leaf")

    def stalk_model(name, height, leaves, cobs):
        m = Model(name)
        m.add("plant", "stalk", cylinder(0.035, 0.025, height, seg=6), None)
        rng = np.random.default_rng(int(height * 100))
        for i in range(leaves):
            y = height * (0.15 + 0.75 * i / max(leaves, 1))
            ang = i * 137.5
            ln = 0.35 + 0.15 * rng.uniform()
            m.add("plant", "leaf" if i % 2 else "leaf_dark", blade(0.07, ln, 0.0),
                  chain(T(0, y, 0), Ry(ang), Rx(55 + rng.uniform(-10, 10))))
        for i in range(cobs):
            y = height * (0.5 + 0.12 * i)
            ang = 90 + 180 * i
            m.add("plant", "corn", cylinder(0.045, 0.03, 0.22, seg=7), chain(T(0, y, 0), Ry(ang), Rx(30), T(0, 0, 0.04)))
            m.add("plant", "husk", blade(0.08, 0.20, 0.2), chain(T(0, y, 0), Ry(ang), Rx(26), T(0, 0, 0.09)))
        if cobs:
            m.add("plant", "corn", blade(0.05, 0.18, 0.0), chain(T(0, height, 0), Rz(10)))
        m.write()

    stalk_model("corn_2", 0.45, 4, 0)
    stalk_model("corn_3", 1.05, 7, 0)
    stalk_model("corn_4", 1.35, 8, 2)
    m = Model("corn_item")
    m.add("item", "corn", cylinder(0.10, 0.07, 0.48, seg=9), T(0, -0.24, 0))
    for i in range(3):
        m.add("item", "husk", blade(0.14, 0.38, 0.15), chain(T(0, -0.24, 0), Ry(120 * i), T(0, 0, 0.08), Rx(-8)))
    m.write()


def pumpkin_faces(r):
    faces = sphere(r, 10, 6)
    # carve ribs: pull alternate meridians inwards
    out = []
    for f in faces:
        pts = []
        for p in f["p"]:
            lon = math.atan2(-p[2], p[0])
            rib = 1.0 - 0.08 * (0.5 + 0.5 * math.cos(lon * 10))
            pts.append(np.array([p[0] * rib, p[1], p[2] * rib]))
        out.append(dict(p=pts, uv=f["uv"]))
    return out


def make_pumpkin():
    seeds_stage("pumpkin")
    sprout_stage("pumpkin", "leaf")
    for stage, leaves, fruit, fruit_mat in ((2, 4, 0.0, None), (3, 6, 0.09, "pumpkin_green"), (4, 7, 0.20, "pumpkin")):
        m = Model(f"pumpkin_{stage}")
        rng = np.random.default_rng(stage + 40)
        for i in range(leaves):
            ang = 360 * i / leaves + rng.uniform(-15, 15)
            dist = 0.12 + 0.08 * stage * rng.uniform(0.7, 1.0)
            m.add("plant", "leaf" if i % 2 else "leaf_dark",
                  jitter_faces(cylinder(0.11 + 0.02 * stage, 0.09, 0.02, seg=6), 0.01, i),
                  chain(Ry(ang), T(dist, 0.05 + 0.03 * (i % 2), 0), Rz(-12)))
            m.add("plant", "stalk", box(dist, 0.02, 0.02), chain(Ry(ang), T(dist / 2, 0.03, 0)))
        if fruit > 0:
            m.add("plant", fruit_mat, pumpkin_faces(fruit), chain(T(0.02, fruit * 0.68, 0.04), S(1.0, 0.72, 1.0)))
            m.add("plant", "stem", cylinder(0.02, 0.015, 0.06, seg=5), T(0.02, fruit * 1.38, 0.04))
        m.write()
    m = Model("pumpkin_item")
    m.add("item", "pumpkin", pumpkin_faces(0.24), chain(T(0, -0.02, 0), S(1.0, 0.75, 1.0)))
    m.add("item", "stem", cylinder(0.035, 0.025, 0.1, seg=5), T(0, 0.15, 0))
    m.add("item", "leaf", quad_xy(0.12, 0.08), chain(T(0.05, 0.18, 0), Rx(-70)))
    m.write()


# ---------------------------------------------------------------------------
# Nature
# ---------------------------------------------------------------------------


def make_trees():
    # fruit tree (fruit positions are configured in src/data/models.js)
    m = Model("fruit_tree")
    m.add("trunk", "trunk", cylinder(0.14, 0.10, 1.2, seg=7, uv_scale=1.5), None)
    for i, (x, y, z, r) in enumerate([(0, 1.65, 0, 0.75), (0.45, 1.45, 0.15, 0.50), (-0.42, 1.50, -0.10, 0.52),
                                      (0.05, 2.05, -0.15, 0.55), (-0.1, 1.45, 0.42, 0.45)]):
        m.add("crown", "crown" if i % 2 == 0 else "crown_dark", blob(r, 8, 6, 0.06, i), T(x, y, z))
    m.write()

    def round_tree(name, mat_a, mat_b, height, seed):
        mm = Model(name)
        mm.add("trunk", "trunk", cylinder(0.18, 0.12, height * 0.5, seg=7, uv_scale=1.5), None)
        rng = np.random.default_rng(seed)
        for i in range(6):
            a = rng.uniform(0, 2 * math.pi)
            d = rng.uniform(0.0, 0.6) if i else 0
            y = height * (0.62 + rng.uniform(0, 0.25))
            r = rng.uniform(0.55, 0.85) * (height / 3.2)
            mm.add("crown", mat_a if i % 2 == 0 else mat_b, blob(r, 8, 6, 0.08, i + seed),
                   T(math.cos(a) * d, y, math.sin(a) * d))
        mm.write()

    round_tree("tree_round", "crown", "crown_dark", 3.4, 11)
    round_tree("tree_round_b", "crown_dark", "crown", 2.8, 23)
    round_tree("tree_autumn", "crown_autumn", "crown", 3.1, 37)

    m = Model("tree_pine")
    m.add("trunk", "trunk", cylinder(0.14, 0.10, 0.8, seg=6, uv_scale=1.5), None)
    for i, (y, r, h) in enumerate([(0.5, 1.0, 1.4), (1.2, 0.8, 1.2), (1.8, 0.55, 1.1)]):
        m.add("crown", "pine", jitter_faces(cylinder(r, 0.0, h, seg=8), 0.04, i), T(0, y, 0))
    m.write()

    for name, mat, r, seed in (("apple", "apple", 0.09, 1), ("orange", "orange", 0.095, 2)):
        m = Model(name)
        m.add("fruit", mat, blob(r, 8, 6, 0.0), T(0, -r * 0.9, 0))
        m.add("fruit", "stem", box(0.02, 0.06, 0.02), T(0, 0.0, 0))
        m.add("fruit", "leaf", quad_xy(0.06, 0.035), chain(T(0.02, 0.02, 0), Rz(-40), Rx(-80)))
        m.write()
    # bigger item versions for icons
    for name, mat in (("apple_item", "apple"), ("orange_item", "orange")):
        m = Model(name)
        m.add("item", mat, blob(0.22, 10, 7, 0.0), S(1.0, 0.95 if mat == "apple" else 1.0, 1.0))
        m.add("item", "stem", box(0.035, 0.12, 0.035), chain(T(0, 0.24, 0), Rz(10)))
        m.add("item", "leaf", quad_xy(0.14, 0.08), chain(T(0.05, 0.25, 0), Rz(-35), Rx(-70)))
        m.write()


def make_small_nature():
    m = Model("bush")
    for i, (x, y, z, r) in enumerate([(0, 0.32, 0, 0.42), (0.3, 0.25, 0.1, 0.3), (-0.28, 0.24, -0.05, 0.32),
                                      (0.05, 0.25, 0.3, 0.28)]):
        m.add("bush", "crown" if i % 2 else "crown_dark", blob(r, 7, 5, 0.04, i + 3), T(x, y, z))
    m.write()

    for name, seed, sc in (("rock", 5, (1.0, 0.6, 0.8)), ("rock_b", 9, (0.8, 0.9, 0.7))):
        m = Model(name)
        m.add("rock", "rock", jitter_faces(sphere(0.35, 7, 5, uv_scale=2.0), 0.06, seed),
              chain(T(0, 0.12, 0), S(*sc)))
        m.write()

    for color in ("pink", "blue", "yellow", "white"):
        m = Model(f"flower_{color}")
        for i, (x, z, h) in enumerate([(0, 0, 0.34), (0.1, 0.07, 0.26), (-0.08, 0.09, 0.3)]):
            m.add("stem", "stalk", box(0.02, h, 0.02), T(x, h / 2, z))
            for k in range(5):
                m.add("bloom", f"petal_{color}", box(0.07, 0.02, 0.05),
                      chain(T(x, h, z), Ry(72 * k + i * 20), T(0, 0, 0.04)))
            m.add("bloom", "flower_core", box(0.04, 0.035, 0.04), T(x, h + 0.01, z))
            m.add("stem", "leaf", quad_xy(0.05, 0.08), chain(T(x, h * 0.4, z), Rx(-40), Ry(i * 90)))
        m.write()

    m = Model("grass_tuft")
    leaf_fan(m, "grass", "grass_blade", 7, 0.26, 0.05, 18, tip=0.0, radius=0.02, seed=12)
    leaf_fan(m, "grass", "grass_tall", 5, 0.20, 0.05, 30, tip=0.0, radius=0.03, twist=20, seed=13)
    m.write()

    m = Model("tall_grass")
    leaf_fan(m, "grass", "grass_tall", 10, 0.55, 0.06, 12, tip=0.0, radius=0.05, seed=21)
    leaf_fan(m, "grass", "grass_blade", 8, 0.45, 0.06, 22, tip=0.0, radius=0.08, twist=15, seed=22)
    m.write()

    m = Model("hay_bale")
    m.add("hay", "hay", cylinder(0.38, 0.38, 0.75, seg=12, uv_scale=1.5), chain(T(-0.375, 0.38, 0), Rz(-90)))
    m.write()


# ---------------------------------------------------------------------------
# Buildings and props
# ---------------------------------------------------------------------------


def gable_building(m, w, d, wall_h, roof_h, wall_mat, roof_mat, overhang=0.25, roof_thick=0.12, uv=0.8, y0=0.0):
    m.add("walls", wall_mat, box(w, wall_h, d, uv_scale=uv), T(0, y0 + wall_h / 2, 0))
    m.add("walls", wall_mat, prism(w - 0.02, d, roof_h, uv_scale=uv), T(0, y0 + wall_h, 0))
    slope_len = math.hypot(d / 2 + overhang, roof_h + overhang * roof_h / (d / 2))
    angle = math.degrees(math.atan2(roof_h, d / 2))
    for side in (-1, 1):
        mat = chain(T(0, y0 + wall_h + roof_h, 0), Rx(angle * side), T(0, roof_thick / 2, side * slope_len / 2))
        m.add("roof", roof_mat, box(w + overhang * 2, roof_thick, slope_len, uv_scale=uv), mat)
    m.add("roof", roof_mat, box(w + overhang * 2 + 0.02, 0.12, 0.18), T(0, y0 + wall_h + roof_h + 0.06, 0))


def window(m, x, y, z, w=0.6, h=0.6, facing=0):
    base = chain(T(x, y, z), Ry(facing))
    m.add("walls", "trim_white", box(w + 0.12, h + 0.12, 0.06), base)
    m.add("glow", "window_glow", box(w, h, 0.04), chain(base, T(0, 0, 0.02)))
    m.add("walls", "trim_white", box(0.05, h, 0.03), chain(base, T(0, 0, 0.05)))
    m.add("walls", "trim_white", box(w, 0.05, 0.03), chain(base, T(0, 0, 0.05)))
    m.add("walls", "wood_dark", box(w + 0.2, 0.06, 0.14), chain(base, T(0, -h / 2 - 0.06, 0.05)))


def make_house():
    m = Model("house")
    w, d, wh, rh = 4.2, 3.4, 2.2, 1.3
    m.add("walls", "stone", box(w + 0.2, 0.3, d + 0.2, uv_scale=1.2), T(0, 0.15, 0))
    gable_building(m, w, d, wh, rh, "wall_blue", "roof_thatch", overhang=0.35, roof_thick=0.18)
    m.add("walls", "door", box(0.85, 1.55, 0.08, uv_scale=1.0), T(0.6, 0.3 + 0.775, d / 2 + 0.02))
    m.add("walls", "trim_white", box(1.0, 0.1, 0.1), T(0.6, 1.9, d / 2 + 0.03))
    m.add("walls", "gold", box(0.06, 0.06, 0.05), T(0.92, 1.05, d / 2 + 0.08))
    window(m, -1.1, 1.3, d / 2 + 0.03)
    window(m, w / 2 + 0.03, 1.3, 0.4, facing=90)
    window(m, -w / 2 - 0.03, 1.3, -0.3, facing=-90)
    window(m, 0.0, wh + 0.55, d / 2 + 0.03, w=0.5, h=0.45)
    # porch
    m.add("walls", "wood", box(2.2, 0.12, 1.0), T(0.6, 0.3, d / 2 + 0.5))
    for side in (-1, 1):
        m.add("walls", "wood_dark", box(0.12, 1.9, 0.12), T(0.6 + side * 1.0, 1.25, d / 2 + 0.92))
    m.add("roof", "roof_brown", box(2.5, 0.08, 1.1), chain(T(0.6, 2.2, d / 2 + 0.55), Rx(12)))
    # chimney
    m.add("walls", "stone", box(0.5, 1.3, 0.5, uv_scale=1.2), T(-1.3, wh + rh + 0.2, -0.6))
    m.add("walls", "stone", box(0.6, 0.12, 0.6), T(-1.3, wh + rh + 0.88, -0.6))
    # flower boxes
    m.add("walls", "wood_dark", box(0.8, 0.15, 0.2), T(-1.1, 0.9, d / 2 + 0.12))
    for i in range(4):
        m.add("walls", "petal_pink" if i % 2 else "petal_yellow", box(0.1, 0.1, 0.1), T(-1.4 + i * 0.2, 1.02, d / 2 + 0.12))
    m.write()


def make_barn():
    m = Model("barn")
    w, d, wh, rh = 5.0, 4.0, 2.6, 1.5
    m.add("walls", "stone", box(w + 0.1, 0.25, d + 0.1, uv_scale=1.2), T(0, 0.12, 0))
    gable_building(m, w, d, wh, rh, "wall_yellow", "roof_red", overhang=0.3, roof_thick=0.16)
    # big door with white X trim
    door_w, door_h = 1.9, 2.0
    z = d / 2 + 0.03
    m.add("walls", "door", box(door_w, door_h, 0.06, uv_scale=1.0), T(0, door_h / 2 + 0.1, z))
    m.add("walls", "trim_white", box(door_w + 0.16, 0.12, 0.08), T(0, door_h + 0.16, z + 0.02))
    for side in (-1, 1):
        m.add("walls", "trim_white", box(0.12, door_h, 0.08), T(side * (door_w / 2 + 0.02), door_h / 2 + 0.1, z + 0.02))
        diag = math.hypot(door_w / 2, door_h)
        ang = math.degrees(math.atan2(door_w / 2, door_h))
        for half in (-1, 1):
            m.add("walls", "trim_white", box(0.08, diag, 0.05),
                  chain(T(half * door_w / 4, door_h / 2 + 0.1, z + 0.04), Rz(ang * side)))
    m.add("walls", "trim_white", box(0.06, door_h, 0.05), T(0, door_h / 2 + 0.1, z + 0.05))
    window(m, 0, wh + 0.6, d / 2 + 0.03, w=0.7, h=0.6)
    window(m, w / 2 + 0.03, 1.5, 0, facing=90, w=0.8)
    for side in (-1, 1):
        m.add("walls", "trim_white", box(0.12, wh, 0.12), T(side * (w / 2), wh / 2, d / 2))
        m.add("walls", "trim_white", box(0.12, wh, 0.12), T(side * (w / 2), wh / 2, -d / 2))
    m.write()


def make_coop():
    m = Model("coop")
    w, d, wh, rh = 2.4, 2.0, 1.4, 0.8
    # stilts
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.add("walls", "wood_dark", box(0.12, 0.4, 0.12), T(sx * (w / 2 - 0.1), 0.2, sz * (d / 2 - 0.1)))
    m.add("walls", "wood", box(w + 0.1, 0.1, d + 0.1), T(0, 0.45, 0))
    gable_building(m, w, d, wh, rh, "wall_white", "roof_red", overhang=0.2, roof_thick=0.1, y0=0.5)
    m.add("walls", "door", box(0.45, 0.6, 0.05), T(0.5, 0.82, d / 2 + 0.03))
    m.add("walls", "wood", box(0.45, 0.06, 0.9), chain(T(0.5, 0.25, d / 2 + 0.42), Rx(28)))
    window(m, -0.5, 1.25, d / 2 + 0.03, w=0.4, h=0.35)
    m.write()


def make_shop():
    m = Model("shop")
    w, d = 3.0, 1.4
    m.add("counter", "wood", box(w, 0.9, d * 0.6, uv_scale=1.0), T(0, 0.45, 0.25))
    m.add("counter", "wood_dark", box(w + 0.1, 0.08, d * 0.6 + 0.1), T(0, 0.94, 0.25))
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.add("counter", "wood_dark", box(0.12, 2.3, 0.12), T(sx * (w / 2 - 0.06), 1.15, sz * (d / 2 - 0.06)))
    # striped awning
    stripes = 8
    sw = (w + 0.4) / stripes
    for i in range(stripes):
        mat = "awning_red" if i % 2 == 0 else "awning_white"
        x = -(w + 0.4) / 2 + sw * (i + 0.5)
        m.add("awning", mat, box(sw, 0.05, d + 0.5), chain(T(x, 2.35, 0.1), Rx(14)))
        m.add("awning", mat, box(sw, 0.25, 0.04), T(x, 2.12, d / 2 + 0.38))
    # crates with produce on the counter
    for i, (x, mat) in enumerate([(-1.0, "tomato"), (-0.3, "carrot"), (0.4, "apple"), (1.05, "corn")]):
        m.add("counter", "wood_pale", box(0.5, 0.2, 0.4), T(x, 1.08, 0.3))
        rng = np.random.default_rng(i)
        for k in range(5):
            dx, dz = rng.uniform(-0.15, 0.15, 2)
            m.add("counter", mat, blob(0.07, 6, 4, 0.0), T(x + dx, 1.2, 0.3 + dz))
    # sign board
    m.add("counter", "wood_pale", box(1.4, 0.4, 0.06), T(0, 2.75, d / 2 + 0.3))
    m.add("counter", "awning_red", box(1.0, 0.12, 0.02), T(0, 2.77, d / 2 + 0.34))
    m.write()


def make_bin():
    m = Model("shipping_bin")
    m.add("box", "wood", box(1.1, 0.65, 0.75, uv_scale=1.5), T(0, 0.325, 0))
    for y in (0.12, 0.52):
        m.add("box", "metal", box(1.12, 0.06, 0.77), T(0, y, 0))
    m.add("box", "gold", box(0.25, 0.12, 0.02), T(0, 0.42, 0.385))
    # lid: pivot on the back edge (y = 0.65, z = -0.375)
    m.add("lid", "wood_dark", box(1.16, 0.08, 0.8, uv_scale=1.5), T(0, 0.69, 0.0))
    m.add("lid", "metal", box(0.2, 0.05, 0.06), T(0, 0.69, 0.42))
    m.write()


def make_fence():
    m = Model("fence")
    for x in (-0.5, 0.5):
        m.add("fence", "wood_pale", box(0.11, 0.72, 0.11, uv_scale=1.5), T(x, 0.36, 0))
        m.add("fence", "wood_pale", box(0.13, 0.05, 0.13), T(x, 0.745, 0))
    for y in (0.28, 0.56):
        m.add("fence", "wood_pale", box(1.0, 0.08, 0.05, uv_scale=1.5), T(0, y, 0))
    m.write()


def make_lamp():
    m = Model("lamp_post")
    m.add("post", "wood_dark", box(0.12, 2.1, 0.12, uv_scale=1.5), T(0, 1.05, 0))
    m.add("post", "wood_dark", box(0.5, 0.08, 0.08), T(0.2, 2.0, 0))
    m.add("post", "metal", box(0.03, 0.18, 0.03), T(0.42, 1.88, 0))
    m.add("lantern", "metal", box(0.24, 0.05, 0.24, top_scale=(0.5, 0.5)), T(0.42, 1.78, 0))
    m.add("glow", "lantern_glow", box(0.16, 0.22, 0.16), T(0.42, 1.64, 0))
    m.add("lantern", "metal", box(0.2, 0.04, 0.2), T(0.42, 1.51, 0))
    m.write()


def make_windmill():
    m = Model("windmill")
    m.add("tower", "stone", box(1.6, 4.0, 1.6, uv_scale=0.8, top_scale=(0.62, 0.62)), T(0, 2.0, 0))
    m.add("tower", "roof_red", cylinder(0.85, 0.0, 1.0, seg=8, angle_offset=math.pi / 8), T(0, 4.0, 0))
    m.add("tower", "door", box(0.6, 1.0, 0.06), T(0, 0.5, 0.80))
    window(m, 0, 2.6, 0.62, w=0.35, h=0.4)
    m.add("tower", "wood_dark", box(0.18, 0.18, 0.5), T(0, 3.6, 0.6))
    # blades (pivot at hub: 0, 3.6, 0.9)
    m.add("blades", "wood_dark", cylinder(0.14, 0.14, 0.12, seg=8), chain(T(0, 3.6, 0.84), Rx(90)))
    for i in range(4):
        rot = chain(T(0, 3.6, 0.92), Rz(90 * i + 45))
        m.add("blades", "wood_dark", box(0.08, 2.0, 0.05), chain(rot, T(0, 1.05, 0)))
        m.add("blades", "awning_white", box(0.5, 1.5, 0.02), chain(rot, T(0.3, 1.25, 0.02)))
        for k in range(4):
            m.add("blades", "wood_dark", box(0.55, 0.04, 0.04), chain(rot, T(0.3, 0.55 + k * 0.45, 0.03)))
    m.write()


def make_well():
    m = Model("well")
    m.add("well", "stone", cylinder(0.65, 0.65, 0.7, seg=10, uv_scale=1.2), None)
    m.add("well", "water", cylinder(0.5, 0.5, 0.01, seg=10), T(0, 0.6, 0))
    for side in (-1, 1):
        m.add("well", "wood_dark", box(0.1, 1.4, 0.1), T(side * 0.55, 1.2, 0))
    m.add("well", "roof_brown", prism(1.5, 1.2, 0.5, uv_scale=1.0), T(0, 1.85, 0))
    m.add("well", "wood", box(1.2, 0.08, 0.08), T(0, 1.5, 0))
    m.add("well", "wood_dark", cylinder(0.12, 0.1, 0.18, seg=7), T(0.0, 1.1, 0))
    m.write()


def make_scarecrow():
    m = Model("scarecrow")
    m.add("post", "wood_dark", box(0.1, 1.7, 0.1), T(0, 0.85, 0))
    m.add("body", "wood_dark", box(1.2, 0.08, 0.08), T(0, 1.25, 0))
    m.add("body", "shirt", box(0.45, 0.5, 0.25), T(0, 1.1, 0))
    m.add("body", "overalls", box(0.47, 0.18, 0.27), T(0, 0.88, 0))
    for side in (-1, 1):
        m.add("body", "shirt", box(0.35, 0.16, 0.18), T(side * 0.38, 1.25, 0))
        m.add("body", "straw", box(0.06, 0.14, 0.06), T(side * 0.6, 1.2, 0))
    m.add("body", "sack", box(0.32, 0.32, 0.3), T(0, 1.55, 0))
    m.add("body", "eye", box(0.06, 0.06, 0.02), T(-0.07, 1.58, 0.15))
    m.add("body", "eye", box(0.06, 0.06, 0.02), T(0.07, 1.58, 0.15))
    m.add("body", "straw", cylinder(0.32, 0.30, 0.03, seg=10), T(0, 1.71, 0))
    m.add("body", "straw", cylinder(0.17, 0.12, 0.2, seg=8), T(0, 1.73, 0))
    m.write()


def make_props():
    m = Model("crate")
    m.add("crate", "wood", box(0.6, 0.6, 0.6, uv_scale=1.5), T(0, 0.3, 0))
    m.add("crate", "wood_dark", box(0.62, 0.08, 0.62), T(0, 0.58, 0))
    m.add("crate", "wood_dark", box(0.62, 0.08, 0.62), T(0, 0.04, 0))
    m.write()

    m = Model("barrel")
    m.add("barrel", "wood", cylinder(0.3, 0.3, 0.8, seg=10, uv_scale=1.5), None)
    for y in (0.1, 0.65):
        m.add("barrel", "metal", cylinder(0.315, 0.315, 0.06, seg=10, caps=False), T(0, y, 0))
    m.write()

    m = Model("trough")
    m.add("trough", "wood", box(1.4, 0.35, 0.5, uv_scale=1.5), T(0, 0.25, 0))
    m.add("trough", "hay", box(1.25, 0.05, 0.38), T(0, 0.43, 0))
    for side in (-1, 1):
        m.add("trough", "wood_dark", box(0.08, 0.12, 0.45), T(side * 0.6, 0.06, 0))
    m.write()


def pond_radius(a):
    return 3.0 + 0.35 * math.sin(3 * a + 0.5) + 0.22 * math.cos(5 * a)


def make_pond():
    """Water surface (animated by the vertex shader) plus a muddy bank."""
    rings, seg = 7, 40
    m = Model("pond_water")
    for k in range(rings):
        r0, r1 = k / rings, (k + 1) / rings
        for i in range(seg):
            a0 = 2 * math.pi * i / seg
            a1 = 2 * math.pi * (i + 1) / seg
            p = lambda a, t: np.array([math.cos(a) * pond_radius(a) * t, 0.1, -math.sin(a) * pond_radius(a) * t])
            pts = [p(a0, r0), p(a0, r1), p(a1, r1), p(a1, r0)]
            if k == 0:
                pts = [pts[0], pts[1], pts[2]]
            # radial-then-angular order is already counter-clockwise seen from above
            m.add("water", "water", [dict(p=pts, uv=None)])
    rng = np.random.default_rng(3)
    for i in range(6):
        a = rng.uniform(0, 2 * math.pi)
        d = rng.uniform(0.8, 2.2)
        x, z = math.cos(a) * d, -math.sin(a) * d
        m.add("lily", "leaf_dark", cylinder(0.32, 0.32, 0.02, seg=9), chain(T(x, 0.105, z), Ry(rng.uniform(0, 360))))
        if i % 2 == 0:
            for k in range(5):
                m.add("lily", "petal_pink", box(0.08, 0.03, 0.05), chain(T(x, 0.14, z), Ry(72 * k), T(0, 0, 0.05), Rx(-25)))
            m.add("lily", "flower_core", box(0.05, 0.04, 0.05), T(x, 0.15, z))
    m.write()

    m = Model("pond_bank")
    for i in range(seg):
        a0 = 2 * math.pi * i / seg
        a1 = 2 * math.pi * (i + 1) / seg
        inner = lambda a: np.array([math.cos(a) * pond_radius(a) * 0.97, 0.12, -math.sin(a) * pond_radius(a) * 0.97])
        outer = lambda a: np.array([math.cos(a) * (pond_radius(a) + 0.55), 0.0, -math.sin(a) * (pond_radius(a) + 0.55)])
        pts = [inner(a0), outer(a0), outer(a1), inner(a1)]
        m.add("bank", "soil_mound", [dict(p=pts, uv=None)])
    m.write()


def make_soil_tile():
    m = Model("soil_tile")
    m.add("soil", "soil_tile", box(0.98, 0.05, 0.98, uv_scale=1.0, top_scale=(0.97, 0.97)), T(0, 0.025, 0))
    m.write()

    m = Model("tile_marker")
    # square outline used to highlight the tile under the mouse
    t, h = 0.07, 0.03
    for side in (-1, 1):
        m.add("marker", "trim_white", box(1.0, h, t), T(0, h / 2, side * (0.5 - t / 2)))
        m.add("marker", "trim_white", box(t, h, 1.0 - 2 * t), T(side * (0.5 - t / 2), h / 2, 0))
    m.write()

    m = Model("ring_marker")
    # circular outline used to highlight animals, trees and buildings
    seg = 28
    for k in range(seg):
        a0 = 2 * math.pi * k / seg
        a1 = 2 * math.pi * (k + 1) / seg
        pts = []
        for a, r in ((a0, 0.44), (a1, 0.44), (a1, 0.5), (a0, 0.5)):
            pts.append(np.array([math.cos(a) * r, 0.02, -math.sin(a) * r]))
        m.add("marker", "trim_white", [dict(p=pts[::-1], uv=None)])
    m.write()


# ---------------------------------------------------------------------------
# Inventory items and tools (also used to render HUD icons)
# ---------------------------------------------------------------------------


def make_items():
    m = Model("egg")
    m.add("item", "egg", blob(0.17, 10, 7, 0.0), S(1.0, 1.3, 1.0))
    m.write()

    m = Model("milk")
    m.add("item", "milk", cylinder(0.14, 0.14, 0.32, seg=10), T(0, -0.25, 0))
    m.add("item", "milk", cylinder(0.14, 0.06, 0.1, seg=10), T(0, 0.07, 0))
    m.add("item", "cap_blue", cylinder(0.065, 0.065, 0.06, seg=10), T(0, 0.17, 0))
    m.add("item", "cap_blue", cylinder(0.142, 0.142, 0.1, seg=10, caps=False), T(0, -0.12, 0))
    m.write()

    m = Model("wool")
    m.add("item", "wool", blob(0.2, 8, 6, 0.03, 4), None)
    for i in range(3):
        m.add("item", "wool", blob(0.11, 6, 4, 0.02, 10 + i), T(0.13 * math.cos(i * 2.1), 0.1, 0.13 * math.sin(i * 2.1)))
    m.write()

    m = Model("seed_bag")
    m.add("item", "sack", box(0.34, 0.36, 0.22, top_scale=(0.55, 0.6)), T(0, -0.08, 0))
    m.add("item", "sack", box(0.2, 0.1, 0.14, top_scale=(1.4, 1.4)), T(0, 0.15, 0))
    m.add("item", "wood_dark", cylinder(0.1, 0.1, 0.03, seg=8), T(0, 0.10, 0))
    m.write()

    m = Model("hoe")
    m.add("item", "wood", box(0.06, 0.9, 0.06, uv_scale=2.0), chain(Rz(-35), T(0, 0, 0)))
    m.add("item", "blade_metal", box(0.26, 0.05, 0.14), chain(Rz(-35), T(0.06, 0.43, 0), Rz(-20)))
    m.write()

    m = Model("watering_can")
    m.add("item", "can_green", cylinder(0.18, 0.16, 0.30, seg=10), T(0, -0.18, 0))
    m.add("item", "can_green", box(0.06, 0.06, 0.34), chain(T(0, -0.05, 0.18), Rx(-50), T(0, 0, 0.12)))
    m.add("item", "metal_light", cylinder(0.06, 0.04, 0.05, seg=8), chain(T(0, 0.12, 0.34), Rx(40)))
    m.add("item", "can_green", box(0.05, 0.05, 0.3), T(0, 0.2, -0.02))
    m.add("item", "can_green", box(0.05, 0.12, 0.05), T(0, 0.14, -0.15))
    m.add("item", "can_green", box(0.05, 0.12, 0.05), T(0, 0.14, 0.11))
    m.write()

    m = Model("basket")
    m.add("item", "wood", cylinder(0.2, 0.25, 0.22, seg=10, uv_scale=2.0), T(0, -0.15, 0))
    m.add("item", "apple", blob(0.08, 6, 4, 0.0), T(-0.06, 0.08, 0.02))
    m.add("item", "orange", blob(0.08, 6, 4, 0.0), T(0.08, 0.08, -0.03))
    m.add("item", "egg", blob(0.06, 6, 4, 0.0), T(0.0, 0.09, 0.09))
    for i in range(7):
        a = math.pi * i / 6
        m.add("item", "wood_dark", box(0.04, 0.04, 0.06), T(0.24 * math.cos(a), 0.07 + 0.25 * math.sin(a), 0))
    m.write()

    m = Model("coin")
    m.add("item", "gold", cylinder(0.22, 0.22, 0.06, seg=14), chain(Rx(90), T(0, -0.03, 0)))
    m.add("item", "gold", box(0.06, 0.2, 0.02), T(0, 0, 0.035))
    m.write()

    m = Model("chicken_icon")
    m.add("item", "white_fur", blob(0.2, 8, 6, 0.0), T(0, 0, 0))
    m.write()

    m = Model("upgrade_icon")
    m.add("item", "wood", box(0.12, 0.4, 0.12), T(0, -0.1, 0))
    m.add("item", "gold", cylinder(0.25, 0.0, 0.25, seg=4), T(0, 0.08, 0))
    m.write()

    m = Model("sapling")
    m.add("item", "soil_mound", cylinder(0.2, 0.16, 0.12, seg=8), T(0, -0.25, 0))
    m.add("item", "trunk", box(0.05, 0.35, 0.05), T(0, -0.05, 0))
    m.add("item", "crown", blob(0.18, 7, 5, 0.03, 2), T(0, 0.2, 0))
    m.write()


def main():
    builders = [make_farmer, make_chicken, make_cow, make_sheep, make_carrot, make_tomato, make_corn, make_pumpkin,
                make_trees, make_small_nature, make_house, make_barn, make_coop, make_shop, make_bin, make_fence,
                make_lamp, make_windmill, make_well, make_scarecrow, make_props, make_pond, make_soil_tile, make_items]
    for build in builders:
        build()
    files = sorted(f for f in os.listdir(OUT_DIR) if f.endswith(".obj"))
    print(f"{len(files)} OBJ models written to {OUT_DIR}")


if __name__ == "__main__":
    main()
