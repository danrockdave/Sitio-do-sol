/**
 * Wavefront OBJ parser written from scratch (no third-party code).
 *
 * Supported:
 *   v, vt, vn                    positions, texture coordinates, normals
 *   f a b c ...                  faces with any number of vertices (fan triangulation)
 *   f v | v/vt | v//vn | v/vt/vn all index forms, including negative (relative) indices
 *   o / g                        object or group names (kept as separate "parts")
 *   usemtl / mtllib              material assignment and material libraries
 *
 * Missing normals are computed (area-weighted smooth normals); missing texture
 * coordinates default to (0, 0). The V coordinate is flipped because textures
 * are uploaded with the first image row at t = 0.
 *
 * Output (ready for a single interleaved vertex buffer):
 *   vertices: Float32Array  [px, py, pz, nx, ny, nz, u, v] per vertex
 *   indices:  Uint32Array   triangle list
 *   parts:    [{ name, start, count, submeshes: [{ material, start, count }] }]
 *   mtllibs:  string[]
 *   bounds:   { min: [x, y, z], max: [x, y, z] }
 */

const FLOATS_PER_VERTEX = 8;

export function parseOBJ(text) {
  const positions = [];
  const texcoords = [];
  const normals = [];
  const mtllibs = [];

  // Triangles grouped by "object|material" key, keeping first-seen order.
  const groups = new Map();
  let currentObject = 'default';
  let currentMaterial = 'default';

  const groupFor = () => {
    const key = `${currentObject}\u0000${currentMaterial}`;
    let group = groups.get(key);
    if (!group) {
      group = { object: currentObject, material: currentMaterial, corners: [] };
      groups.set(key, group);
    }
    return group;
  };

  // Converts an OBJ index (1-based, or negative = relative to the end) to 0-based.
  const resolveIndex = (raw, count) => {
    if (raw === undefined || raw === '') return -1;
    const value = parseInt(raw, 10);
    if (Number.isNaN(value)) return -1;
    return value < 0 ? count + value : value - 1;
  };

  const lines = text.split(/\r?\n/);
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    let line = lines[lineNo];
    const hash = line.indexOf('#');
    if (hash >= 0) line = line.slice(0, hash);
    line = line.trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0];

    switch (keyword) {
      case 'v':
        positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
        break;
      case 'vt':
        texcoords.push(parseFloat(parts[1]), parts.length > 2 ? parseFloat(parts[2]) : 0);
        break;
      case 'vn':
        normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
        break;
      case 'f': {
        const vertexCount = positions.length / 3;
        const uvCount = texcoords.length / 2;
        const normalCount = normals.length / 3;
        const face = [];
        for (let i = 1; i < parts.length; i++) {
          const refs = parts[i].split('/');
          face.push([
            resolveIndex(refs[0], vertexCount),
            resolveIndex(refs[1], uvCount),
            resolveIndex(refs[2], normalCount),
          ]);
        }
        if (face.length < 3) break;
        const group = groupFor();
        // Fan triangulation: (0, i, i + 1). Works for convex polygons,
        // which is what modelling tools export for quads and n-gons.
        for (let i = 1; i < face.length - 1; i++) {
          group.corners.push(face[0], face[i], face[i + 1]);
        }
        break;
      }
      case 'o':
      case 'g':
        currentObject = parts.slice(1).join(' ') || 'default';
        break;
      case 'usemtl':
        currentMaterial = parts.slice(1).join(' ') || 'default';
        break;
      case 'mtllib':
        mtllibs.push(parts.slice(1).join(' '));
        break;
      default:
        // s, l, vp, cstype... are ignored on purpose.
        break;
    }
  }

  // Smooth normals for corners that have none: accumulate face normals per position.
  const accumulated = new Float32Array(positions.length);
  let needsGeneratedNormals = false;
  for (const group of groups.values()) {
    const c = group.corners;
    for (let t = 0; t < c.length; t += 3) {
      if (c[t][2] >= 0 && c[t + 1][2] >= 0 && c[t + 2][2] >= 0) continue;
      needsGeneratedNormals = true;
      const a = c[t][0] * 3;
      const b = c[t + 1][0] * 3;
      const d = c[t + 2][0] * 3;
      const e1x = positions[b] - positions[a];
      const e1y = positions[b + 1] - positions[a + 1];
      const e1z = positions[b + 2] - positions[a + 2];
      const e2x = positions[d] - positions[a];
      const e2y = positions[d + 1] - positions[a + 1];
      const e2z = positions[d + 2] - positions[a + 2];
      // Cross product length is proportional to the triangle area (area weighting).
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      for (const idx of [a, b, d]) {
        accumulated[idx] += nx;
        accumulated[idx + 1] += ny;
        accumulated[idx + 2] += nz;
      }
    }
  }
  if (needsGeneratedNormals) {
    for (let i = 0; i < accumulated.length; i += 3) {
      const len = Math.hypot(accumulated[i], accumulated[i + 1], accumulated[i + 2]) || 1;
      accumulated[i] /= len;
      accumulated[i + 1] /= len;
      accumulated[i + 2] /= len;
    }
  }

  // Build the de-duplicated vertex buffer, ordered by object then material
  // so every part is one contiguous index range.
  const objectOrder = [];
  for (const group of groups.values()) {
    if (!objectOrder.includes(group.object)) objectOrder.push(group.object);
  }

  const vertexMap = new Map();
  const vertexData = [];
  const indexData = [];
  const outParts = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  const emitVertex = (corner) => {
    const [vi, ti, ni] = corner;
    const key = `${vi}/${ti}/${ni}`;
    let index = vertexMap.get(key);
    if (index !== undefined) return index;
    index = vertexData.length / FLOATS_PER_VERTEX;
    vertexMap.set(key, index);

    const px = positions[vi * 3];
    const py = positions[vi * 3 + 1];
    const pz = positions[vi * 3 + 2];
    let nx, ny, nz;
    if (ni >= 0) {
      nx = normals[ni * 3];
      ny = normals[ni * 3 + 1];
      nz = normals[ni * 3 + 2];
    } else {
      nx = accumulated[vi * 3];
      ny = accumulated[vi * 3 + 1];
      nz = accumulated[vi * 3 + 2];
    }
    const u = ti >= 0 ? texcoords[ti * 2] : 0;
    const v = ti >= 0 ? 1 - texcoords[ti * 2 + 1] : 0;
    vertexData.push(px, py, pz, nx, ny, nz, u, v);

    min[0] = Math.min(min[0], px); min[1] = Math.min(min[1], py); min[2] = Math.min(min[2], pz);
    max[0] = Math.max(max[0], px); max[1] = Math.max(max[1], py); max[2] = Math.max(max[2], pz);
    return index;
  };

  for (const objectName of objectOrder) {
    const part = { name: objectName, start: indexData.length, count: 0, submeshes: [] };
    for (const group of groups.values()) {
      if (group.object !== objectName || group.corners.length === 0) continue;
      const start = indexData.length;
      for (const corner of group.corners) {
        if (corner[0] < 0) throw new Error('OBJ: face references a missing vertex');
        indexData.push(emitVertex(corner));
      }
      part.submeshes.push({ material: group.material, start, count: indexData.length - start });
    }
    part.count = indexData.length - part.start;
    if (part.count > 0) outParts.push(part);
  }

  return {
    vertices: new Float32Array(vertexData),
    indices: new Uint32Array(indexData),
    parts: outParts,
    mtllibs,
    bounds: { min, max },
  };
}

export const OBJ_FLOATS_PER_VERTEX = FLOATS_PER_VERTEX;
