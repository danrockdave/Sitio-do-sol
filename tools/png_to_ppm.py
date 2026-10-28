#!/usr/bin/env python3
"""
Converts images (PNG, JPG, ...) to the Netpbm formats read by the game.

  RGB images   -> .ppm (P6)
  images with transparency -> .pam (P7, RGBA)

The game decodes these files with its own parser (src/loaders/netpbm.js),
so textures that come with downloaded models must be converted once and
the map_Kd lines of their .mtl files pointed at the new files.

Usage:
  python3 tools/png_to_ppm.py texture.png [more.png ...]
  python3 tools/png_to_ppm.py --fix-mtl assets/models/quaternius/*.mtl

Requires Pillow (pip install pillow) only for this offline conversion.
"""

import os
import re
import sys

from PIL import Image


def convert(path):
    img = Image.open(path)
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    base = os.path.splitext(path)[0]
    if has_alpha:
        img = img.convert("RGBA")
        out = base + ".pam"
        w, h = img.size
        with open(out, "wb") as fh:
            fh.write(f"P7\nWIDTH {w}\nHEIGHT {h}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n".encode("ascii"))
            fh.write(img.tobytes())
    else:
        img = img.convert("RGB")
        out = base + ".ppm"
        img.save(out, format="PPM")
    print(f"{path} -> {out}")
    return out


def fix_mtl(path):
    """Converts every texture referenced by an MTL file and rewrites the references."""
    directory = os.path.dirname(path)
    with open(path, encoding="utf-8", errors="replace") as fh:
        lines = fh.readlines()
    out = []
    for line in lines:
        match = re.match(r"^(\s*map_\w+\s+(?:-\S+\s+\S+\s+)*)(.+?)\s*$", line)
        if match and not re.search(r"\.(ppm|pgm|pam)$", match.group(2), re.I):
            texture = os.path.join(directory, match.group(2))
            if os.path.exists(texture):
                converted = convert(texture)
                line = f"{match.group(1)}{os.path.relpath(converted, directory)}\n"
        out.append(line)
    with open(path, "w", encoding="utf-8") as fh:
        fh.writelines(out)


def main(args):
    if not args:
        print(__doc__)
        return 1
    if args[0] == "--fix-mtl":
        for path in args[1:]:
            fix_mtl(path)
    else:
        for path in args:
            convert(path)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
