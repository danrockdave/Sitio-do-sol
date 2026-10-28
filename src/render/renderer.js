/**
 * Frame renderer (WebGL2 only).
 *
 * Passes per frame:
 *   1. shadow map   depth from the sun/moon (orthographic light camera)
 *   2. sky          full-screen procedural gradient, sun, moon, stars, clouds
 *   3. opaque       every queued model with Phong lighting + shadows + fog
 *   4. overlay      alpha-blended unlit geometry (tile highlight)
 *   5. billboards   particles, fireflies and "ready" bubbles
 * The HUD is drawn afterwards by UIRenderer.
 */

import { mat4, vec3, vec4 } from '../../lib/gl-matrix/index.js';
import { ShaderProgram } from '../gl/shader.js';
import { ShadowMap } from '../gl/framebuffer.js';
import { bindInstanceAttributes, INSTANCE_FLOATS, INSTANCE_BYTES } from '../gl/mesh.js';
import { createSolidTexture } from '../gl/texture.js';

const MAX_POINT_LIGHTS = 8;
const BILLBOARD_FLOATS = 13;

export class Renderer {
  constructor(gl, assets) {
    this.gl = gl;
    this.assets = assets;
    const s = assets.shaders;
    this.phong = new ShaderProgram(gl, s.phong.vs, s.phong.fs, 'phong');
    this.shadowProgram = new ShaderProgram(gl, s.shadow.vs, s.shadow.fs, 'shadow');
    this.sky = new ShaderProgram(gl, s.sky.vs, s.sky.fs, 'sky');
    this.billboard = new ShaderProgram(gl, s.billboard.vs, s.billboard.fs, 'billboard');

    this.shadowMap = new ShadowMap(gl, 2048);
    this.whiteTexture = createSolidTexture(gl, [255, 255, 255, 255]);
    this.emptyVao = gl.createVertexArray();

    this.instanceBuffer = gl.createBuffer();
    this.packed = new Float32Array(INSTANCE_FLOATS * 4096);

    this.settings = { shadows: true, debugView: 0, pcf: 1 };
    this.stats = { drawCalls: 0, triangles: 0, instances: 0 };

    this.lightView = mat4.create();
    this.lightProj = mat4.create();
    this.lightViewProj = mat4.create();
    this.shadowMatrix = mat4.create();

    this._initBillboards();
  }

  /** Recreates the shadow map when the quality preset changes its resolution. */
  setShadowSize(size) {
    if (this.shadowMap.size === size) return;
    const gl = this.gl;
    gl.deleteTexture(this.shadowMap.texture);
    gl.deleteFramebuffer(this.shadowMap.framebuffer);
    this.shadowMap = new ShadowMap(gl, size);
  }

  _initBillboards() {
    const gl = this.gl;
    this.billboardVao = gl.createVertexArray();
    gl.bindVertexArray(this.billboardVao);
    const corners = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5]),
      gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.billboardBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.billboardBuffer);
    const stride = BILLBOARD_FLOATS * 4;
    const layout = [[1, 4, 0], [2, 4, 16], [3, 4, 32], [4, 1, 48]];
    for (const [loc, size, offset] of layout) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    this.billboardData = new Float32Array(BILLBOARD_FLOATS * 512);
  }

  /**
   * frame = {
   *   width, height, camera, env, time,
   *   queue, overlay,              RenderQueue instances
   *   pointLights: [{ pos, color, range }],
   *   ground: { splatTexture, splatRect },
   *   billboards: [{ pos, size, uv, color, mode }],
   *   iconTexture
   * }
   */
  render(frame) {
    const gl = this.gl;
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;

    this._packInstances([frame.queue, frame.overlay]);
    const shadowsOn = this.settings.shadows && frame.env.shadowStrength > 0.02;
    if (shadowsOn) this._shadowPass(frame);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, frame.width, frame.height);
    const fog = frame.env.fogColor;
    gl.clearColor(fog[0], fog[1], fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this._skyPass(frame);
    this._opaquePass(frame, shadowsOn);
    this._overlayPass(frame);
    this._billboardPass(frame);
  }

  // ---------------------------------------------------------------------
  // instance packing: every batch of every queue goes into one GPU buffer
  // ---------------------------------------------------------------------

  _packInstances(queues) {
    const gl = this.gl;
    let total = 0;
    for (const q of queues) total += q.instanceCount();
    if (total * INSTANCE_FLOATS > this.packed.length) {
      this.packed = new Float32Array(Math.max(total, this.packed.length / INSTANCE_FLOATS * 2) * INSTANCE_FLOATS);
    }
    let cursor = 0;
    for (const q of queues) {
      for (const batch of q.order) {
        if (!batch.count) continue;
        batch.offset = cursor * INSTANCE_BYTES;
        this.packed.set(batch.data.subarray(0, batch.count * INSTANCE_FLOATS), cursor * INSTANCE_FLOATS);
        cursor += batch.count;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.packed.subarray(0, cursor * INSTANCE_FLOATS), gl.DYNAMIC_DRAW);
    this.stats.instances = cursor;
  }

  // ---------------------------------------------------------------------
  // 1. shadow map
  // ---------------------------------------------------------------------

  _computeLightMatrices(frame) {
    const cam = frame.camera;
    const L = frame.env.lightDir;
    const extent = Math.min(42, Math.max(18, cam.distance * 1.45));
    const center = [cam.target[0], 0, cam.target[2]];
    const eye = [center[0] + L[0] * 60, center[1] + L[1] * 60, center[2] + L[2] * 60];
    const up = Math.abs(L[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0];
    mat4.lookAt(this.lightView, eye, center, up);
    mat4.ortho(this.lightProj, -extent, extent, -extent, extent, 1, 130);
    mat4.multiply(this.lightViewProj, this.lightProj, this.lightView);

    // Snap the projection to whole shadow-map texels so shadows don't shimmer while moving.
    const origin = vec4.transformMat4(vec4.create(), [0, 0, 0, 1], this.lightViewProj);
    const half = this.shadowMap.size / 2;
    const ox = origin[0] * half;
    const oy = origin[1] * half;
    this.lightProj[12] += (Math.round(ox) - ox) / half;
    this.lightProj[13] += (Math.round(oy) - oy) / half;
    mat4.multiply(this.lightViewProj, this.lightProj, this.lightView);

    // world -> [0,1] texture space
    const bias = mat4.fromValues(0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1);
    mat4.multiply(this.shadowMatrix, bias, this.lightViewProj);
  }

  _shadowPass(frame) {
    const gl = this.gl;
    this._computeLightMatrices(frame);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.shadowMap.bind();
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 2.0);

    const p = this.shadowProgram.use();
    p.setMat4('uLightViewProj', this.lightViewProj);
    p.set1f('uTime', frame.time);
    for (const batch of frame.queue.order) {
      if (!batch.count || !batch.model.castShadow) continue;
      gl.bindVertexArray(batch.model.vao);
      bindInstanceAttributes(gl, this.instanceBuffer, batch.offset);
      p.set1f('uWind', batch.model.wind);
      gl.drawElementsInstanced(gl.TRIANGLES, batch.part.count, gl.UNSIGNED_INT, batch.part.start * 4, batch.count);
      this.stats.drawCalls += 1;
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ---------------------------------------------------------------------
  // 2. sky
  // ---------------------------------------------------------------------

  _skyPass(frame) {
    const gl = this.gl;
    const env = frame.env;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    const p = this.sky.use();
    p.setMat4('uInvViewProj', frame.camera.invViewProj);
    p.set3fv('uCameraPos', frame.camera.eye);
    p.set3fv('uSkyTop', env.skyTop);
    p.set3fv('uSkyHorizon', env.skyHorizon);
    p.set3fv('uSunDir', env.sunDir);
    p.set3fv('uSunColor', env.lightColor);
    p.set3fv('uMoonDir', env.moonDir);
    p.set1f('uSunVisible', env.sunVisible);
    p.set1f('uMoonVisible', env.moonVisible);
    p.set1f('uStars', env.stars);
    p.set1f('uTime', frame.time);
    p.set3fv('uCloudColor', env.cloudColor);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.drawCalls += 1;
    gl.depthMask(true);
  }

  // ---------------------------------------------------------------------
  // 3. opaque Phong pass
  // ---------------------------------------------------------------------

  /** Sets all per-frame Phong uniforms (also used by the icon renderer). */
  setupPhong(frame, shadowsOn) {
    const gl = this.gl;
    const env = frame.env;
    const p = this.phong.use();
    p.setMat4('uViewProj', frame.camera.viewProj);
    p.setMat4('uShadowMatrix', this.shadowMatrix);
    p.set3fv('uCameraPos', frame.camera.eye);
    p.set1f('uTime', frame.time);
    p.set3fv('uLightDir', env.lightDir);
    p.set3fv('uLightColor', env.lightColor);
    p.set3fv('uAmbientSky', env.ambientSky);
    p.set3fv('uAmbientGround', env.ambientGround);
    p.set3fv('uFogColor', env.fogColor);
    p.set1f('uFogDensity', env.fogDensity);
    p.set1f('uGlow', env.glow);
    p.set1i('uShadowsEnabled', shadowsOn ? 1 : 0);
    p.set1f('uShadowStrength', env.shadowStrength);
    p.set1f('uShadowTexel', 1 / this.shadowMap.size);
    p.set1i('uPcfRadius', this.settings.pcf);
    p.set1i('uDebugView', this.settings.debugView);

    const lights = (frame.pointLights || []).slice(0, MAX_POINT_LIGHTS);
    const pos = new Float32Array(MAX_POINT_LIGHTS * 3);
    const col = new Float32Array(MAX_POINT_LIGHTS * 3);
    const range = new Float32Array(MAX_POINT_LIGHTS);
    lights.forEach((l, i) => {
      pos.set(l.pos, i * 3);
      col.set(l.color, i * 3);
      range[i] = l.range;
    });
    p.set1i('uPointCount', lights.length);
    p.set3fv('uPointPos', pos);
    p.set3fv('uPointColor', col);
    p.set1fv('uPointRange', range);

    // texture units: 0 material map, 1 shadow map, 2 grass, 3 dirt, 4 splat
    p.set1i('uMap', 0);
    p.set1i('uShadowMap', 1);
    p.set1i('uGrassMap', 2);
    p.set1i('uDirtMap', 3);
    p.set1i('uSplatMap', 4);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowMap.texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.assets.textures.grass);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.assets.textures.dirt);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, frame.ground ? frame.ground.splatTexture : this.whiteTexture);
    if (frame.ground) {
      p.set4fv('uSplatRect', frame.ground.splatRect);
      p.set1f('uGroundTiling', 0.32);
    }
    p.set1i('uMode', 0);
    return p;
  }

  /** Draws every batch of a queue with the Phong program already set up. */
  drawBatches(queue, p, { overlay = false } = {}) {
    const gl = this.gl;
    let lastMode = -1;
    for (const batch of queue.order) {
      if (!batch.count) continue;
      const model = batch.model;
      gl.bindVertexArray(model.vao);
      bindInstanceAttributes(gl, this.instanceBuffer, batch.offset);
      p.set1f('uWind', model.wind);
      p.set1f('uWave', model.wave || 0);
      for (const sub of batch.part.submeshes) {
        const m = model.materials[sub.material];
        const mode = overlay ? 2 : m.ground ? 1 : 0;
        if (mode !== lastMode) {
          p.set1i('uMode', mode);
          lastMode = mode;
        }
        p.set3fv('uKd', m.kd);
        p.set3fv('uKs', m.ks);
        p.set3fv('uKe', m.ke);
        p.set1f('uNs', m.ns);
        gl.activeTexture(gl.TEXTURE0);
        if (m.texture) {
          gl.bindTexture(gl.TEXTURE_2D, m.texture);
          p.set1i('uHasMap', 1);
        } else {
          gl.bindTexture(gl.TEXTURE_2D, this.whiteTexture);
          p.set1i('uHasMap', 0);
        }
        gl.drawElementsInstanced(gl.TRIANGLES, sub.count, gl.UNSIGNED_INT, sub.start * 4, batch.count);
        this.stats.drawCalls += 1;
        this.stats.triangles += (sub.count / 3) * batch.count;
      }
    }
    gl.bindVertexArray(null);
  }

  _opaquePass(frame, shadowsOn) {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);
    const p = this.setupPhong(frame, shadowsOn);
    this.drawBatches(frame.queue, p);
  }

  _overlayPass(frame) {
    if (!frame.overlay.instanceCount()) return;
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-2, -2);
    const p = this.phong.use();
    this.drawBatches(frame.overlay, p, { overlay: true });
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.depthMask(true);
    p.set1i('uMode', 0);
  }

  // ---------------------------------------------------------------------
  // 5. billboards
  // ---------------------------------------------------------------------

  _billboardPass(frame) {
    const list = frame.billboards;
    if (!list || !list.length) return;
    const gl = this.gl;
    const eye = frame.camera.eye;
    // back-to-front for correct blending
    list.sort((a, b) => vec3.sqrDist(b.pos, eye) - vec3.sqrDist(a.pos, eye));
    if (list.length * BILLBOARD_FLOATS > this.billboardData.length) {
      this.billboardData = new Float32Array(list.length * BILLBOARD_FLOATS * 2);
    }
    const d = this.billboardData;
    list.forEach((b, i) => {
      const o = i * BILLBOARD_FLOATS;
      d[o] = b.pos[0]; d[o + 1] = b.pos[1]; d[o + 2] = b.pos[2]; d[o + 3] = b.size;
      const uv = b.uv || [0, 0, 1, 1];
      d[o + 4] = uv[0]; d[o + 5] = uv[1]; d[o + 6] = uv[2]; d[o + 7] = uv[3];
      d[o + 8] = b.color[0]; d[o + 9] = b.color[1]; d[o + 10] = b.color[2]; d[o + 11] = b.color[3];
      d[o + 12] = b.mode || 0;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.billboardBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, list.length * BILLBOARD_FLOATS), gl.DYNAMIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    const p = this.billboard.use();
    p.setMat4('uViewProj', frame.camera.viewProj);
    p.set3fv('uCamRight', frame.camera.right);
    p.set3fv('uCamUp', frame.camera.up);
    p.set1i('uIcons', 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frame.iconTexture || this.whiteTexture);
    gl.bindVertexArray(this.billboardVao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, list.length);
    this.stats.drawCalls += 1;
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
