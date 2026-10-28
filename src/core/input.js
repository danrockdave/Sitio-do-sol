/**
 * Keyboard, mouse and touch state (plain DOM events; no input libraries).
 *
 * Mouse mode: the usual mouse position, buttons, wheel and right-drag.
 *
 * Touch mode (phones and tablets):
 *   - a touch that starts on the interface (hit-tested by the UI) behaves
 *     like the mouse, so every button works by tapping;
 *   - a touch on the left side of the screen becomes a floating joystick;
 *   - a touch elsewhere rotates the camera when dragged and becomes a "tap"
 *     on the 3D scene when released quickly without moving;
 *   - two fingers on the scene pinch to zoom.
 */

const PREVENT = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F2', 'F3', 'F4']);
const JOYSTICK_RADIUS = 56;   // CSS pixels
const TAP_MOVE = 14;
// max seconds for a tap (?taptime=N overrides it for slow automated test browsers)
const TAP_TIME = parseFloat(new URLSearchParams(window.location.search).get('taptime')) || 0.42;

export class Input {
  constructor(canvas, { touch = false } = {}) {
    this.canvas = canvas;
    this.touchMode = touch;
    this.keys = new Set();
    this.pressed = new Set();
    this.buttons = new Set();
    this.buttonsPressed = new Set();
    this.buttonsReleased = new Set();
    this.mouse = { x: -1, y: -1, inside: false, dy: 0 };
    this.pressPos = { x: -1, y: -1 };
    this.dragDistance = 0;
    this.wheel = 0;
    this.dragX = 0;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // touch state
    this.touches = new Map();
    this.joystick = null;        // { cx, cy, x, y } in CSS pixels
    this.taps = [];              // released quick taps on the scene, CSS pixels
    this.pinch = 0;              // accumulated log zoom from pinching
    this.uiHitTest = null;       // (x, y) CSS -> true when the point is on the interface
    this._uiTouch = null;

    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.buttons.clear();
      this.touches.clear();
      this.joystick = null;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.touchMode) return;
      const p = this._local(e);
      this.mouse.dy += p.y - this.mouse.y;
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.inside = true;
      if (this.buttons.has(0)) this.dragDistance = Math.max(this.dragDistance, Math.hypot(p.x - this.pressPos.x, p.y - this.pressPos.y));
      if (this.buttons.has(2)) this.dragX += e.clientX - this.lastMouseX;
      this.lastMouseX = e.clientX;
    });
    canvas.addEventListener('mouseleave', () => {
      if (!this.touchMode) this.mouse.inside = false;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.touchMode) return;
      this.buttons.add(e.button);
      this.buttonsPressed.add(e.button);
      this.lastMouseX = e.clientX;
      if (e.button === 0) {
        const p = this._local(e);
        this.pressPos = { x: p.x, y: p.y };
        this.dragDistance = 0;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (this.touchMode) return;
      this.buttons.delete(e.button);
      this.buttonsReleased.add(e.button);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });

    // pointer events carry the touches (mouse pointers are handled above)
    canvas.addEventListener('pointerdown', (e) => this._touchStart(e));
    canvas.addEventListener('pointermove', (e) => this._touchMove(e));
    canvas.addEventListener('pointerup', (e) => this._touchEnd(e, false));
    canvas.addEventListener('pointercancel', (e) => this._touchEnd(e, true));
  }

  _local(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ------------------------------------------------------------------
  // touch
  // ------------------------------------------------------------------

  _touchStart(e) {
    if (e.pointerType !== 'touch' || !this.touchMode) return;
    e.preventDefault();
    const p = this._local(e);
    const t = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, t0: e.timeStamp / 1000, moved: 0, role: 'world' };
    if (!this._uiTouch && this.uiHitTest && this.uiHitTest(p.x, p.y)) {
      t.role = 'ui';
      this._uiTouch = t.id;
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.inside = true;
      this.pressPos = { x: p.x, y: p.y };
      this.dragDistance = 0;
      this.buttons.add(0);
      this.buttonsPressed.add(0);
    } else if (!this.joystick && p.x < this.canvas.clientWidth * 0.42) {
      t.role = 'joystick';
      this.joystick = { id: t.id, cx: p.x, cy: p.y, x: p.x, y: p.y };
    }
    this.touches.set(t.id, t);
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  }

  _touchMove(e) {
    if (e.pointerType !== 'touch') return;
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    e.preventDefault();
    const p = this._local(e);
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    t.moved = Math.max(t.moved, Math.hypot(p.x - t.sx, p.y - t.sy));

    if (t.role === 'ui') {
      this.mouse.dy += dy;
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.dragDistance = t.moved;
    } else if (t.role === 'joystick') {
      this.joystick.x = p.x;
      this.joystick.y = p.y;
    } else {
      const world = [...this.touches.values()].filter((o) => o.role === 'world');
      if (world.length >= 2) {
        const [a, b] = world;
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        t.x = p.x;
        t.y = p.y;
        const after = Math.hypot(a.x - b.x, a.y - b.y);
        if (before > 10 && after > 10) this.pinch += Math.log(before / after) * 0.8;
        return;
      }
      if (t.moved > TAP_MOVE * 0.6) this.dragX += dx * 1.15;
    }
    t.x = p.x;
    t.y = p.y;
  }

  _touchEnd(e, cancelled) {
    if (e.pointerType !== 'touch') return;
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    e.preventDefault();
    this.touches.delete(e.pointerId);
    if (t.role === 'ui') {
      this._uiTouch = null;
      this.buttons.delete(0);
      this.buttonsReleased.add(0);
      if (cancelled) this.dragDistance = 999;
    } else if (t.role === 'joystick') {
      this.joystick = null;
    } else if (!cancelled) {
      // event timestamps, so a slow frame does not turn a quick tap into a long press
      const quick = e.timeStamp / 1000 - t.t0 < TAP_TIME;
      const others = [...this.touches.values()].some((o) => o.role === 'world');
      if (quick && t.moved < TAP_MOVE && !others) this.taps.push({ x: t.x, y: t.y });
    }
  }

  /** Joystick direction in screen space: x right, y down, length 0..1. */
  joystickVector() {
    if (!this.joystick) return { x: 0, y: 0, length: 0 };
    let x = (this.joystick.x - this.joystick.cx) / JOYSTICK_RADIUS;
    let y = (this.joystick.y - this.joystick.cy) / JOYSTICK_RADIUS;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y, length: Math.min(1, length) };
  }

  get joystickRadius() {
    return JOYSTICK_RADIUS;
  }

  // ------------------------------------------------------------------
  // queries
  // ------------------------------------------------------------------

  down(code) {
    return this.keys.has(code);
  }

  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  mouseDown(button) {
    return this.buttons.has(button);
  }

  mousePressed(button) {
    return this.buttonsPressed.has(button);
  }

  mouseReleased(button) {
    return this.buttonsReleased.has(button);
  }

  endFrame() {
    this.pressed.clear();
    this.buttonsPressed.clear();
    if (this.buttonsReleased.size && this.touchMode && this._uiTouch === null) {
      // a finger left the screen: no hover state until the next touch
      this.mouse.inside = false;
      this.mouse.x = -1;
      this.mouse.y = -1;
    }
    this.buttonsReleased.clear();
    this.wheel = 0;
    this.dragX = 0;
    this.mouse.dy = 0;
    this.taps.length = 0;
    this.pinch = 0;
  }
}
