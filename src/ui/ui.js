/**
 * Immediate-mode 2D interface drawn with WebGL.
 *
 * Everything (panels, buttons, text, icons) is a textured or SDF-shaded
 * quad batched into a single vertex buffer and drawn with one call per
 * frame. Coordinates are logical pixels: a 1280x720 reference layout on
 * desktops and a ~900x480 layout on phones, scaled to the real canvas.
 *
 * Buttons fire when the pointer is released over the button it pressed
 * (and did not drag), which lets lists scroll by dragging on touch screens.
 * Scrollable areas clip their content per quad in the fragment shader.
 */

import { ShaderProgram } from '../gl/shader.js';
import { createTexture } from '../gl/texture.js';
import { Font } from './font.js';

const FLOATS = 20;          // pos2 uv2 color4 local4 params4 clip4
const MAX_QUADS = 12000;
const NO_CLIP = [-1e6, -1e6, 1e6, 1e6];
const CLICK_SLOP = 12;      // CSS pixels a press may move and still count as a click

export const C = {
  panel: [0.99, 0.95, 0.86, 0.98],
  panelDark: [0.95, 0.88, 0.74, 1],
  panelEdge: [0.55, 0.38, 0.24, 1],
  ink: [0.30, 0.20, 0.12, 1],
  inkSoft: [0.50, 0.38, 0.27, 1],
  green: [0.42, 0.66, 0.28, 1],
  greenHover: [0.50, 0.74, 0.33, 1],
  greenEdge: [0.28, 0.47, 0.18, 1],
  beige: [0.95, 0.87, 0.72, 1],
  beigeHover: [0.99, 0.92, 0.78, 1],
  beigeEdge: [0.74, 0.60, 0.43, 1],
  red: [0.86, 0.34, 0.28, 1],
  redHover: [0.93, 0.42, 0.35, 1],
  redEdge: [0.62, 0.22, 0.18, 1],
  gray: [0.80, 0.78, 0.74, 1],
  grayEdge: [0.64, 0.62, 0.58, 1],
  grayInk: [0.52, 0.50, 0.47, 1],
  gold: [1.0, 0.80, 0.28, 1],
  white: [1, 1, 1, 1],
  shadow: [0.12, 0.07, 0.03, 0.30],
  dark: [0.10, 0.08, 0.06, 0.70],
};

const BUTTON_STYLES = {
  primary: { bg: C.green, hover: C.greenHover, edge: C.greenEdge, ink: C.white },
  secondary: { bg: C.beige, hover: C.beigeHover, edge: C.beigeEdge, ink: C.ink },
  danger: { bg: C.red, hover: C.redHover, edge: C.redEdge, ink: C.white },
  disabled: { bg: C.gray, hover: C.gray, edge: C.grayEdge, ink: C.grayInk },
};

export class UI {
  constructor(gl, assets, input) {
    this.gl = gl;
    this.input = input;
    this.font = new Font(assets.font);
    this.program = new ShaderProgram(gl, assets.shaders.ui.vs, assets.shaders.ui.fs, 'ui');
    this.fontTexture = createTexture(gl, assets.fontImage, { repeat: false, mipmaps: false });
    this.icons = null;
    this.data = new Float32Array(MAX_QUADS * 4 * FLOATS);
    this.count = 0;
    this.hitRects = [];
    this.prevHitRects = [];
    this.modal = false;
    this.mouse = { x: -1, y: -1 };
    this.press = { x: -1, y: -1 };
    this.onClick = null;      // optional callback (click sound)
    this.w = 1280;
    this.h = 720;
    this.scale = 1;
    this.k = 1;               // CSS pixels -> logical pixels
    this.touch = false;
    this.safe = { top: 0, right: 0, bottom: 0, left: 0 };
    this.clip = NO_CLIP;
    this.clipStack = [];
    this.scrollStack = [];
    this.scrollState = {};

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS * 4;
    const layout = [[0, 2, 0], [1, 2, 8], [2, 4, 16], [3, 4, 32], [4, 4, 48], [5, 4, 64]];
    for (const [loc, size, offset] of layout) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    }
    const indices = new Uint32Array(MAX_QUADS * 6);
    for (let i = 0; i < MAX_QUADS; i++) {
      indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }

  // ------------------------------------------------------------------
  // frame
  // ------------------------------------------------------------------

  begin(width, height, dpr, { touch = false, safe = null } = {}) {
    const cssW = width / dpr;
    const cssH = height / dpr;
    this.touch = touch;
    const fit = touch ? Math.min(cssH / 480, cssW / 900) : Math.min(cssW / 1280, cssH / 720);
    this.scale = dpr * Math.min(1.6, Math.max(touch ? 0.6 : 0.72, fit));
    this.k = dpr / this.scale;
    this.w = width / this.scale;
    this.h = height / this.scale;
    this.pixelWidth = width;
    this.pixelHeight = height;
    const s = safe || { top: 0, right: 0, bottom: 0, left: 0 };
    this.safe = { top: s.top * this.k, right: s.right * this.k, bottom: s.bottom * this.k, left: s.left * this.k };

    const input = this.input;
    this.mouse.x = input.mouse.x * this.k;
    this.mouse.y = input.mouse.y * this.k;
    this.press.x = input.pressPos.x * this.k;
    this.press.y = input.pressPos.y * this.k;
    this.justPressed = input.mousePressed(0);
    this.clicked = input.mouseReleased(0) && input.dragDistance < CLICK_SLOP;
    this.mouseDown = input.mouseDown(0);
    this.dragging = this.mouseDown && input.dragDistance >= CLICK_SLOP;
    this.prevHitRects = this.hitRects;
    this.hitRects = [];
    this.count = 0;
    this.cursor = 'default';
    this.clip = NO_CLIP;
    this.clipStack.length = 0;
  }

  /** True when the mouse is over interface elements drawn in the previous frame. */
  mouseBlocked() {
    if (this.modal) return true;
    return this.prevHitRects.some(([x, y, w, h]) => this.mouse.x >= x && this.mouse.x <= x + w && this.mouse.y >= y && this.mouse.y <= y + h);
  }

  /** Hit test in CSS pixels against the last drawn frame (used to route touches). */
  hitTestCss(cssX, cssY) {
    const x = cssX * this.k;
    const y = cssY * this.k;
    return this.hitRects.some(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh);
  }

  /** Converts a CSS pixel coordinate to logical interface units. */
  fromCss(v) {
    return v * this.k;
  }

  block(x, y, w, h) {
    this.hitRects.push([x, y, w, h]);
  }

  _inClip(px, py) {
    const c = this.clip;
    return px >= c[0] && px <= c[2] && py >= c[1] && py <= c[3];
  }

  over(x, y, w, h) {
    const m = this.mouse;
    return m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h && this._inClip(m.x, m.y);
  }

  _pressInside(x, y, w, h) {
    const p = this.press;
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }

  /** Release-based click: pressed and released over the same element without dragging. */
  _click(x, y, w, h) {
    const clicked = this.clicked && this.over(x, y, w, h) && this._pressInside(x, y, w, h);
    if (clicked && this.onClick) this.onClick();
    return clicked;
  }

  /** Press-based trigger for game controls that must react immediately (action button). */
  pressedOn(x, y, w, h) {
    return this.justPressed && this.over(x, y, w, h);
  }

  end() {
    if (!this.count) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.pixelWidth, this.pixelHeight);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const p = this.program.use();
    p.set2f('uResolution', this.w, this.h);
    p.set1i('uFont', 0);
    p.set1i('uIcons', 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fontTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.icons ? this.icons.texture : this.fontTexture);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * 4 * FLOATS);
    gl.drawElements(gl.TRIANGLES, this.count * 6, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
  }

  // ------------------------------------------------------------------
  // clipping and scrolling
  // ------------------------------------------------------------------

  pushClip(x, y, w, h) {
    this.clipStack.push(this.clip);
    const c = this.clip;
    this.clip = [Math.max(c[0], x), Math.max(c[1], y), Math.min(c[2], x + w), Math.min(c[3], y + h)];
  }

  popClip() {
    this.clip = this.clipStack.pop() || NO_CLIP;
  }

  /**
   * Starts a vertically scrollable region; returns the scroll offset to
   * subtract from the content's y. Drag (touch or mouse) or the wheel scrolls.
   */
  beginScroll(id, x, y, w, h, contentHeight) {
    const state = this.scrollState[id] || (this.scrollState[id] = { offset: 0 });
    const max = Math.max(0, contentHeight - h);
    if (this.over(x, y, w, h)) {
      if (this.input.wheel) state.offset += this.input.wheel * 48;
      if (this.dragging && this._pressInside(x, y, w, h)) state.offset -= this.input.mouse.dy * this.k;
    }
    state.offset = Math.max(0, Math.min(max, state.offset));
    this.pushClip(x, y, w, h);
    this.scrollStack.push({ x, y, w, h, max, offset: state.offset, contentHeight });
    return state.offset;
  }

  endScroll() {
    const s = this.scrollStack.pop();
    this.popClip();
    if (!s || s.max <= 0) return;
    const trackH = s.h - 8;
    const thumbH = Math.max(28, trackH * (s.h / s.contentHeight));
    const thumbY = s.y + 4 + (trackH - thumbH) * (s.offset / s.max);
    this.rect(s.x + s.w - 7, s.y + 4, 4, trackH, [0, 0, 0, 0.08], 2);
    this.rect(s.x + s.w - 7, thumbY, 4, thumbH, [0.45, 0.32, 0.2, 0.55], 2);
  }

  resetScroll(id) {
    if (this.scrollState[id]) this.scrollState[id].offset = 0;
  }

  // ------------------------------------------------------------------
  // primitives
  // ------------------------------------------------------------------

  quad(x, y, w, h, uv, color, mode, radius = 0, threshold = 0.5, soft = 0, pad = 0) {
    if (this.count >= MAX_QUADS) return;
    const c = this.clip;
    if (x + w + pad < c[0] || x - pad > c[2] || y + h + pad < c[1] || y - pad > c[3]) return;
    const d = this.data;
    let o = this.count * 4 * FLOATS;
    const x0 = x - pad;
    const y0 = y - pad;
    const x1 = x + w + pad;
    const y1 = y + h + pad;
    const corners = [[x0, y0, uv[0], uv[1], -pad, -pad], [x1, y0, uv[2], uv[1], w + pad, -pad],
      [x1, y1, uv[2], uv[3], w + pad, h + pad], [x0, y1, uv[0], uv[3], -pad, h + pad]];
    for (const [px, py, u, v, lx, ly] of corners) {
      d[o] = px; d[o + 1] = py; d[o + 2] = u; d[o + 3] = v;
      d[o + 4] = color[0]; d[o + 5] = color[1]; d[o + 6] = color[2]; d[o + 7] = color.length > 3 ? color[3] : 1;
      d[o + 8] = lx; d[o + 9] = ly; d[o + 10] = w; d[o + 11] = h;
      d[o + 12] = radius; d[o + 13] = mode; d[o + 14] = threshold; d[o + 15] = soft;
      d[o + 16] = c[0]; d[o + 17] = c[1]; d[o + 18] = c[2]; d[o + 19] = c[3];
      o += FLOATS;
    }
    this.count++;
  }

  rect(x, y, w, h, color, radius = 0) {
    this.quad(x, y, w, h, [0, 0, 0, 0], color, 0, radius);
  }

  circle(cx, cy, r, color) {
    this.quad(cx - r, cy - r, r * 2, r * 2, [0, 0, 0, 0], color, 0, r);
  }

  softShadow(x, y, w, h, radius, blur, color = C.shadow) {
    this.quad(x, y, w, h, [0, 0, 0, 0], color, 0, radius, 0.5, blur, blur);
  }

  panel(x, y, w, h, { radius = 16, fill = C.panel, edge = C.panelEdge, border = 3, shadow = true, block = true } = {}) {
    if (shadow) this.softShadow(x, y + 6, w, h, radius, 14);
    this.rect(x, y, w, h, edge, radius);
    this.rect(x + border, y + border, w - border * 2, h - border * 2, fill, radius - border);
    if (block) this.block(x, y, w, h);
  }

  icon(id, x, y, size, tint = C.white) {
    if (!this.icons) return;
    this.quad(x, y, size, size, this.icons.uv(id), tint, 2);
  }

  measure(text, size) {
    return this.font.measure(String(text), size);
  }

  /**
   * opts: align ('left' | 'center' | 'right'), valign ('top' | 'middle' | 'baseline'),
   *       outline (0..0.4), outlineColor, shadow (bool), maxWidth (shrinks to fit)
   */
  text(str, x, y, size, color = C.ink, opts = {}) {
    str = String(str);
    const font = this.font;
    if (opts.maxWidth) {
      const w0 = font.measure(str, size);
      if (w0 > opts.maxWidth) size *= opts.maxWidth / w0;
    }
    const k = size / font.size;
    const width = font.measure(str, size);
    let startX = x;
    if (opts.align === 'center') startX -= width / 2;
    else if (opts.align === 'right') startX -= width;
    let baseline;
    if (opts.valign === 'middle') baseline = y + size * 0.36;
    else if (opts.valign === 'baseline') baseline = y;
    else baseline = y + font.ascent * k * 0.82;

    const draw = (dx, dy, col, threshold) => {
      let cx = startX + dx;
      const aw = font.meta.atlasWidth;
      const ah = font.meta.atlasHeight;
      for (const ch of str) {
        const g = font.glyph(ch);
        if (g.w) {
          this.quad(cx + g.xoff * k, baseline + dy + g.yoff * k, g.w * k, g.h * k,
            [g.x / aw, g.y / ah, (g.x + g.w) / aw, (g.y + g.h) / ah], col, 1, 0, threshold);
        }
        cx += g.advance * k;
      }
    };
    if (opts.shadow) draw(0, size * 0.07, [0, 0, 0, 0.35 * (color[3] ?? 1)], 0.42);
    if (opts.outline) draw(0, 0, opts.outlineColor || [0, 0, 0, 0.8], 0.5 - opts.outline);
    draw(0, 0, color, 0.5);
    return width;
  }

  textBlock(str, x, y, size, color, maxWidth, lineGap = 1.3) {
    const lines = this.font.wrap(str, size, maxWidth);
    lines.forEach((line, i) => this.text(line, x, y + i * size * lineGap, size, color));
    return lines.length * size * lineGap;
  }

  // ------------------------------------------------------------------
  // widgets
  // ------------------------------------------------------------------

  button(x, y, w, h, label, { variant = 'secondary', disabled = false, size = 18, icon = null } = {}) {
    const style = BUTTON_STYLES[disabled ? 'disabled' : variant];
    const hovered = !disabled && this.over(x, y, w, h);
    const pressed = hovered && this.mouseDown && !this.dragging && this._pressInside(x, y, w, h);
    const lift = pressed ? 2 : 0;
    const r = Math.min(12, h / 2);
    this.rect(x, y + 4, w, h, style.edge, r);
    this.rect(x, y + lift, w, h, hovered && !this.touch ? style.hover : style.bg, r);
    if (hovered) this.cursor = 'pointer';
    let tx = x + w / 2;
    if (icon) {
      const s = h * 0.72;
      const total = s + 6 + this.measure(label, size);
      this.icon(icon, x + (w - total) / 2, y + lift + (h - s) / 2, s);
      tx = x + (w - total) / 2 + s + 6 + this.measure(label, size) / 2;
    }
    this.text(label, tx, y + lift + h / 2, size, style.ink, { align: 'center', valign: 'middle', maxWidth: w - 12 });
    this.block(x, y, w, h + 4);
    return !disabled && this._click(x, y, w, h + 4);
  }

  /** Small round icon button (e.g. close). */
  closeButton(x, y, size = 34) {
    const hovered = this.over(x - 6, y - 6, size + 12, size + 12);
    this.rect(x, y + 3, size, size, C.redEdge, size / 2);
    this.rect(x, y, size, size, hovered && !this.touch ? C.redHover : C.red, size / 2);
    this.text('×', x + size / 2, y + size / 2 - 1, size * 0.8, C.white, { align: 'center', valign: 'middle' });
    if (hovered) this.cursor = 'pointer';
    // generous hit area for fingers
    return this._click(x - 6, y - 6, size + 12, size + 12);
  }

  tab(x, y, w, h, label, active) {
    const hovered = this.over(x, y, w, h);
    const fill = active ? C.panel : hovered && !this.touch ? C.beigeHover : C.beige;
    this.rect(x, y, w, h + 10, active ? C.panelEdge : C.beigeEdge, 12);
    this.rect(x + 3, y + 3, w - 6, h + 10, fill, 10);
    this.text(label, x + w / 2, y + h / 2 + 2, 18, active ? C.ink : C.inkSoft, { align: 'center', valign: 'middle' });
    if (hovered) this.cursor = 'pointer';
    return !active && this._click(x, y, w, h);
  }

  progress(x, y, w, h, t, color = C.green, back = [0, 0, 0, 0.18]) {
    this.rect(x, y, w, h, back, h / 2);
    if (t > 0) this.rect(x, y, Math.max(h, w * Math.min(1, t)), h, color, h / 2);
  }
}
