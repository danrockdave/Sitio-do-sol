/**
 * Wavefront MTL parser written from scratch.
 *
 * Reads the Phong material parameters used by the renderer:
 *   Ka / Kd / Ks / Ke   ambient, diffuse, specular and emissive colours
 *   Ns                  specular exponent (shininess)
 *   d / Tr              opacity
 *   map_Kd              diffuse texture (options such as "-s 1 1 1" are skipped)
 */

export function parseMTL(text) {
  const materials = {};
  let current = null;

  const readColor = (parts) => {
    const r = parseFloat(parts[1]);
    const g = parts.length > 2 ? parseFloat(parts[2]) : r;
    const b = parts.length > 3 ? parseFloat(parts[3]) : r;
    return [r, g, b];
  };

  for (let line of text.split(/\r?\n/)) {
    const hash = line.indexOf('#');
    if (hash >= 0) line = line.slice(0, hash);
    line = line.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const keyword = parts[0];

    if (keyword === 'newmtl') {
      const name = parts.slice(1).join(' ');
      current = {
        name,
        ka: [0, 0, 0],
        kd: [0.8, 0.8, 0.8],
        ks: [0, 0, 0],
        ke: [0, 0, 0],
        ns: 10,
        opacity: 1,
        mapKd: null,
      };
      materials[name] = current;
      continue;
    }
    if (!current) continue;

    switch (keyword) {
      case 'Ka': current.ka = readColor(parts); break;
      case 'Kd': current.kd = readColor(parts); break;
      case 'Ks': current.ks = readColor(parts); break;
      case 'Ke': current.ke = readColor(parts); break;
      case 'Ns': current.ns = Math.max(1, parseFloat(parts[1])); break;
      case 'd': current.opacity = parseFloat(parts[1]); break;
      case 'Tr': current.opacity = 1 - parseFloat(parts[1]); break;
      case 'map_Kd': current.mapKd = textureFileName(parts); break;
      default: break;
    }
  }
  return materials;
}

// map_Kd may carry options ("-s 1 1 1 -o 0 0 0 file.png"); the file name is
// whatever follows the last option and its arguments.
function textureFileName(parts) {
  const optionArgs = { '-s': 3, '-o': 3, '-t': 3, '-mm': 2, '-bm': 1, '-boost': 1, '-texres': 1, '-clamp': 1,
    '-blendu': 1, '-blendv': 1, '-imfchan': 1, '-type': 1 };
  let i = 1;
  while (i < parts.length && parts[i].startsWith('-') && optionArgs[parts[i]] !== undefined) {
    i += 1 + optionArgs[parts[i]];
  }
  return parts.slice(i).join(' ') || null;
}
