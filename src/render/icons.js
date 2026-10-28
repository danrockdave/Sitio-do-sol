/**
 * HUD icon atlas rendered at start-up from the game's own 3D models
 * (render-to-texture into a multisampled framebuffer, then resolved and
 * mipmapped). Swapping a model automatically updates its icon.
 */

import { mat4, vec3 } from '../../lib/gl-matrix/index.js';
import { IconTarget } from '../gl/framebuffer.js';
import { RenderQueue } from './queue.js';

const CELL = 128;
const ATLAS = 1024;
const DEG = Math.PI / 180;

const ICON_ENV = {
  lightDir: vec3.normalize([], [-0.45, 0.85, 0.65]),
  lightColor: [1.0, 0.97, 0.92],
  ambientSky: [0.62, 0.64, 0.68],
  ambientGround: [0.38, 0.34, 0.30],
  fogColor: [0, 0, 0],
  fogDensity: 0,
  glow: 0.2,
  shadowStrength: 0,
};

export class IconAtlas {
  constructor(gl, renderer, assets, defs) {
    this.gl = gl;
    this.renderer = renderer;
    this.assets = assets;
    this.defs = defs;
    this.target = new IconTarget(gl, ATLAS);
    this.texture = this.target.texture;
    this.uvs = {};
  }

  build() {
    const gl = this.gl;
    const r = this.renderer;
    const queue = new RenderQueue();
    const empty = new RenderQueue();
    const debugView = r.settings.debugView;
    r.settings.debugView = 0;

    this.target.bind();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    const perRow = ATLAS / CELL;
    let index = 0;
    for (const [id, parts] of Object.entries(this.defs)) {
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      index++;
      queue.clear();
      const sphere = this._submit(queue, parts);
      if (!sphere) continue;

      const camera = this._camera(sphere);
      r._packInstances([queue, empty]);
      this.target.bind();
      gl.viewport(col * CELL, row * CELL, CELL, CELL);
      const p = r.setupPhong({ camera, env: ICON_ENV, time: 0, pointLights: [], ground: null }, false);
      r.drawBatches(queue, p);

      // texture rows grow upward in GL, so the cell's top edge is (row + 1)
      const inset = 0.5 / ATLAS;
      this.uvs[id] = [col * CELL / ATLAS + inset, (row + 1) * CELL / ATLAS - inset,
        (col + 1) * CELL / ATLAS - inset, row * CELL / ATLAS + inset];
    }
    this.target.resolve();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    r.settings.debugView = debugView;
  }

  _submit(queue, parts) {
    let center = null;
    let radius = 0;
    const spheres = [];
    for (const part of parts) {
      const model = this.assets.models[part.model];
      if (!model) continue;
      const m = mat4.create();
      if (part.offset) mat4.translate(m, m, part.offset);
      if (part.rotY) mat4.rotateY(m, m, part.rotY * DEG);
      if (part.rotZ) mat4.rotateZ(m, m, part.rotZ * DEG);
      if (part.scale) mat4.scale(m, m, [part.scale, part.scale, part.scale]);
      queue.add(model, m);
      const c = vec3.transformMat4([], model.center, m);
      spheres.push({ c, r: model.radius * (part.scale || 1) });
    }
    if (!spheres.length) return null;
    // the first part frames the icon; extra parts may stick out a little
    center = spheres[0].c;
    radius = spheres[0].r;
    for (const s of spheres.slice(1)) {
      const d = vec3.distance(center, s.c) + s.r;
      radius = Math.max(radius, d * 0.92);
    }
    return { center, radius };
  }

  _camera({ center, radius }) {
    const yaw = 28 * DEG;
    const pitch = 24 * DEG;
    const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const eye = [center[0] + dir[0] * radius * 4, center[1] + dir[1] * radius * 4, center[2] + dir[2] * radius * 4];
    const view = mat4.lookAt(mat4.create(), eye, center, [0, 1, 0]);
    const s = radius * 0.98;
    const proj = mat4.ortho(mat4.create(), -s, s, -s, s, radius * 0.5, radius * 8);
    const viewProj = mat4.multiply(mat4.create(), proj, view);
    return { viewProj, eye };
  }

  uv(id) {
    return this.uvs[id] || this.uvs.coin || [0, 1, 1, 0];
  }
}
