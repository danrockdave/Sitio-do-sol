/**
 * Loads every asset the game needs: GLSL sources, OBJ models with their MTL
 * materials, PPM textures and the SDF font. Files are fetched as plain text
 * or bytes and decoded by our own parsers.
 */

import { parseOBJ, OBJ_FLOATS_PER_VERTEX } from './obj.js';
import { parseMTL } from './mtl.js';
import { parseNetpbm } from './netpbm.js';
import { createTexture } from '../gl/texture.js';
import { GpuModel } from '../gl/mesh.js';
import { MODELS, MODEL_BASE } from '../data/models.js';

const SHADER_FILES = ['phong', 'shadow', 'sky', 'billboard', 'ui'];
const GROUND_TEXTURES = { grass: 'assets/textures/grass.ppm', dirt: 'assets/textures/dirt.ppm' };
const FONT_META = 'assets/fonts/poppins_sdf.json';
const FONT_ATLAS = 'assets/fonts/poppins_sdf.pgm';

export class AssetLibrary {
  constructor(gl) {
    this.gl = gl;
    this.models = {};
    this.modelDefs = MODELS;
    this.textures = {};
    this.shaders = {};
    this.font = null;
    this.fontImage = null;
    this.stats = { files: 0, triangles: 0 };
    this._mtlCache = new Map();
    this._textureCache = new Map();
  }

  /** Font and shaders first, so the loading screen can be drawn. */
  async loadEssentials() {
    await Promise.all(SHADER_FILES.map(async (name) => {
      const [vs, fs] = await Promise.all([
        this.fetchText(`src/shaders/${name}.vert`),
        this.fetchText(`src/shaders/${name}.frag`),
      ]);
      this.shaders[name] = { vs, fs };
    }));
    const [meta, atlas] = await Promise.all([this.fetchText(FONT_META), this.fetchBinary(FONT_ATLAS)]);
    this.font = JSON.parse(meta);
    this.fontImage = parseNetpbm(atlas);
  }

  async loadWorldAssets(onProgress) {
    const entries = Object.entries(MODELS);
    const total = entries.length + Object.keys(GROUND_TEXTURES).length;
    let done = 0;
    const tick = (label) => {
      done += 1;
      if (onProgress) onProgress(done / total, label);
    };

    for (const [key, url] of Object.entries(GROUND_TEXTURES)) {
      this.textures[key] = await this.loadTexture(url);
      tick(url);
    }

    // Load models a few at a time to keep the browser responsive.
    const queue = [...entries];
    const worker = async () => {
      while (queue.length) {
        const [key, def] = queue.shift();
        this.models[key] = await this.loadModel(key, def);
        tick(def.file);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  async loadModel(key, def) {
    const url = MODEL_BASE + def.file;
    const geometry = parseOBJ(await this.fetchText(url));
    applyTransform(geometry, def);

    const library = {};
    for (const lib of geometry.mtllibs) {
      Object.assign(library, await this.loadMTL(resolveUrl(url, lib)));
    }

    const materials = {};
    for (const part of geometry.parts) {
      for (const sub of part.submeshes) {
        if (materials[sub.material]) continue;
        const m = library[sub.material];
        materials[sub.material] = {
          name: sub.material,
          kd: m ? m.kd : [0.8, 0.8, 0.8],
          ks: m ? m.ks : [0.1, 0.1, 0.1],
          ke: m ? m.ke : [0, 0, 0],
          ns: m ? m.ns : 10,
          opacity: m ? m.opacity : 1,
          texture: m && m.mapKd ? await this.loadTexture(m.mapKd) : null,
        };
      }
    }
    this.stats.triangles += geometry.indices.length / 3;
    const model = new GpuModel(this.gl, key, geometry, materials);
    model.wind = def.wind || 0;
    model.wave = def.wave || 0;
    model.castShadow = def.shadow !== false;
    model.pivots = def.pivots || {};
    return model;
  }

  async loadMTL(url) {
    if (!this._mtlCache.has(url)) {
      this._mtlCache.set(url, this.fetchText(url).then((text) => {
        const materials = parseMTL(text);
        // texture paths inside an MTL are relative to the MTL file
        for (const m of Object.values(materials)) {
          if (m.mapKd) m.mapKd = resolveUrl(url, m.mapKd);
        }
        return materials;
      }));
    }
    return this._mtlCache.get(url);
  }

  async loadTexture(url) {
    if (!this._textureCache.has(url)) {
      this._textureCache.set(url, this.fetchBinary(url).then((buffer) => {
        if (!/\.(ppm|pgm|pam|pnm)$/i.test(url)) {
          throw new Error(`Textura ${url}: converta para PPM com tools/png_to_ppm.py`);
        }
        return createTexture(this.gl, parseNetpbm(buffer), { repeat: true, mipmaps: true });
      }));
    }
    return this._textureCache.get(url);
  }

  async fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Não foi possível carregar ${url} (${response.status})`);
    this.stats.files += 1;
    return response.text();
  }

  async fetchBinary(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Não foi possível carregar ${url} (${response.status})`);
    this.stats.files += 1;
    return response.arrayBuffer();
  }
}

function resolveUrl(base, relative) {
  const dir = base.slice(0, base.lastIndexOf('/') + 1);
  const parts = (dir + relative).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.') out.push(p);
  }
  return out.join('/');
}

/** Bakes the manifest's scale / rotationY / offset into the vertex data. */
function applyTransform(geometry, def) {
  const scale = Array.isArray(def.scale) ? def.scale : [def.scale || 1, def.scale || 1, def.scale || 1];
  const angle = ((def.rotationY || 0) * Math.PI) / 180;
  const offset = def.offset || [0, 0, 0];
  if (scale.every((s) => s === 1) && angle === 0 && offset.every((o) => o === 0)) return;

  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const v = geometry.vertices;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += OBJ_FLOATS_PER_VERTEX) {
    const x = v[i] * scale[0];
    const y = v[i + 1] * scale[1];
    const z = v[i + 2] * scale[2];
    v[i] = x * c + z * s + offset[0];
    v[i + 1] = y + offset[1];
    v[i + 2] = -x * s + z * c + offset[2];
    // normals: inverse scale, then the same rotation
    const nx = v[i + 3] / scale[0];
    const ny = v[i + 4] / scale[1];
    const nz = v[i + 5] / scale[2];
    const len = Math.hypot(nx, ny, nz) || 1;
    v[i + 3] = (nx * c + nz * s) / len;
    v[i + 4] = ny / len;
    v[i + 5] = (-nx * s + nz * c) / len;
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], v[i + k]);
      max[k] = Math.max(max[k], v[i + k]);
    }
  }
  geometry.bounds = { min, max };
}
