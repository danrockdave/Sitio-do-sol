/**
 * Bridge to the native app shell (Flutter, see the sitio-do-sol-mobile project).
 *
 * JS -> native: messages through the `SitioNative` JavaScript channel
 *   { type: 'ready' }                       game loaded, hide the native splash
 *   { type: 'save', key, value }            mirror a saved value in native storage
 *   { type: 'haptic', kind }                light | medium | success | warning
 *                                           (not sent when vibration is turned off)
 *   { type: 'exit' }                        leave the app (Android back on the title)
 *
 * native -> JS: calls to window.sitioApp (installed by main.js)
 *   restore(values) / onPause() / onResume() / onBack() -> boolean
 * plus window.sitioNativeInsets = { top, right, bottom, left } (CSS pixels)
 * followed by a 'resize' event when the screen insets change.
 *
 * In a regular browser every call is a no-op.
 */

export const HAPTICS_KEY = 'sitio-do-sol-haptics-v1';

function channel() {
  return typeof window.SitioNative !== 'undefined' && typeof window.SitioNative.postMessage === 'function'
    ? window.SitioNative
    : null;
}

export const bridge = {
  get available() {
    return channel() !== null;
  },

  send(type, data = {}) {
    const ch = channel();
    if (!ch) return;
    try {
      ch.postMessage(JSON.stringify({ type, ...data }));
    } catch (err) {
      console.warn('bridge', err);
    }
  },

  ready() {
    this.send('ready');
  },

  get hapticsEnabled() {
    return storage.get(HAPTICS_KEY) !== 'off';
  },

  set hapticsEnabled(on) {
    storage.set(HAPTICS_KEY, on ? 'on' : 'off');
  },

  haptic(kind) {
    if (!this.available || !this.hapticsEnabled) return;
    this.send('haptic', { kind });
  },

  mirror(key, value) {
    this.send('save', { key, value });
  },

  exit() {
    this.send('exit');
  },
};

/** localStorage wrapper that also mirrors writes to the native app. */
export const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key, value) {
    let ok = true;
    try {
      localStorage.setItem(key, value);
    } catch {
      ok = false;
    }
    bridge.mirror(key, value);
    return ok || bridge.available;
  },

  /**
   * Values sent back by the native app at start-up. A value replaces the local
   * one when it is missing locally or, for game saves, when it is newer.
   */
  restore(values) {
    let changed = false;
    for (const [key, value] of Object.entries(values || {})) {
      if (typeof value !== 'string') continue;
      const local = this.get(key);
      if (local === null || isNewerSave(value, local)) {
        try {
          localStorage.setItem(key, value);
          changed = true;
        } catch { /* storage unavailable */ }
      }
    }
    return changed;
  },
};

function isNewerSave(candidate, current) {
  try {
    const a = JSON.parse(candidate);
    const b = JSON.parse(current);
    return typeof a.savedAt === 'number' && typeof b.savedAt === 'number' && a.savedAt > b.savedAt;
  } catch {
    return false;
  }
}
