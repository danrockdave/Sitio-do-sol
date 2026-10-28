#!/usr/bin/env python3
"""
Builds the signed-distance-field (SDF) font atlas used by the WebGL HUD.

Output:
  assets/fonts/poppins_sdf.pgm   grayscale atlas (binary PGM, P5)
  assets/fonts/poppins_sdf.json  glyph metrics

The HUD draws text as textured quads in WebGL; the SDF lets one atlas
render crisp text at any size plus outlines and shadows in the shader.

Run:  python3 tools/generate_font.py
"""

import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "fonts")
FONT_PATH = os.environ.get("FONT_PATH") or "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"

SCALE = 4          # render at SCALE x the output size, then downsample
OUT_SIZE = 40      # output em size in atlas pixels
SPREAD = 6         # distance range in output pixels
ATLAS_W = 1024

CHARS = (
    "".join(chr(c) for c in range(32, 127))
    + "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ"
    + "°ºª•·×…–—“”‘’«»€£"
)


def glyph_sdf(font, ch):
    hi_spread = SPREAD * SCALE
    x0, y0, x1, y1 = font.getbbox(ch, anchor="ls")
    advance = font.getlength(ch)
    if x1 <= x0 or y1 <= y0:
        return None, dict(advance=advance / SCALE)
    pad = hi_spread + SCALE
    w = (x1 - x0) + 2 * pad
    h = (y1 - y0) + 2 * pad
    # round up to a multiple of SCALE so downsampling is exact
    w += (-w) % SCALE
    h += (-h) % SCALE
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).text((pad - x0, pad - y0), ch, font=font, fill=255, anchor="ls")
    mask = np.array(img) > 127
    inside = distance_transform_edt(mask)
    outside = distance_transform_edt(~mask)
    sdf = outside - inside
    value = np.clip(0.5 - sdf / (2.0 * hi_spread), 0.0, 1.0)
    small = value.reshape(h // SCALE, SCALE, w // SCALE, SCALE).mean(axis=(1, 3))
    metrics = dict(
        advance=advance / SCALE,
        xoff=(x0 - pad) / SCALE,
        yoff=(y0 - pad) / SCALE,  # relative to the baseline (negative = above)
        w=small.shape[1],
        h=small.shape[0],
    )
    return small, metrics


def main():
    font = ImageFont.truetype(FONT_PATH, OUT_SIZE * SCALE)
    ascent, descent = font.getmetrics()
    glyphs = {}
    bitmaps = {}
    for ch in CHARS:
        # skip characters the font does not cover (falls back to .notdef box)
        if ch != " " and font.getmask(ch).getbbox() is None:
            continue
        bmp, met = glyph_sdf(font, ch)
        glyphs[ch] = met
        if bmp is not None:
            bitmaps[ch] = bmp

    # shelf packing
    x = y = 0
    row_h = 0
    pad = 1
    placements = {}
    for ch, bmp in sorted(bitmaps.items(), key=lambda kv: -kv[1].shape[0]):
        h, w = bmp.shape
        if x + w + pad > ATLAS_W:
            x = 0
            y += row_h + pad
            row_h = 0
        placements[ch] = (x, y)
        x += w + pad
        row_h = max(row_h, h)
    atlas_h = y + row_h + pad
    atlas_h = 1 << (atlas_h - 1).bit_length()
    atlas = np.zeros((atlas_h, ATLAS_W), dtype=np.float32)
    for ch, (px, py) in placements.items():
        bmp = bitmaps[ch]
        atlas[py:py + bmp.shape[0], px:px + bmp.shape[1]] = bmp
        glyphs[ch]["x"] = px
        glyphs[ch]["y"] = py

    os.makedirs(OUT_DIR, exist_ok=True)
    data = (atlas * 255 + 0.5).astype(np.uint8)
    with open(os.path.join(OUT_DIR, "poppins_sdf.pgm"), "wb") as fh:
        fh.write(f"P5\n{ATLAS_W} {atlas_h}\n255\n".encode("ascii"))
        fh.write(data.tobytes())
    meta = dict(
        size=OUT_SIZE,
        spread=SPREAD,
        ascent=ascent / SCALE,
        descent=descent / SCALE,
        lineHeight=(ascent + descent) / SCALE,
        atlasWidth=ATLAS_W,
        atlasHeight=atlas_h,
        glyphs={ch: {k: round(v, 3) if isinstance(v, float) else v for k, v in m.items()} for ch, m in glyphs.items()},
    )
    with open(os.path.join(OUT_DIR, "poppins_sdf.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False)
    print(f"{len(glyphs)} glyphs, atlas {ATLAS_W}x{atlas_h}")


if __name__ == "__main__":
    main()
