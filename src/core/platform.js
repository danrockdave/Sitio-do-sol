/**
 * Platform detection and graphics quality presets.
 *
 *   touch   phones and tablets (coarse pointer) or ?touch in the URL
 *   native  running inside the Android / iOS app shell (?app or the native bridge)
 *
 * ?desktop forces the mouse and keyboard interface on any device.
 */

const params = new URLSearchParams(window.location.search);
const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

export const PLATFORM = {
  params,
  native: params.has('app') || typeof window.SitioNative !== 'undefined',
  touch: params.has('touch') || (!params.has('desktop') && coarsePointer),
  version: '1.0.0',
};

export const QUALITY_PRESETS = {
  alta: { label: 'alta', shadowSize: 2048, pcf: 1, maxDpr: 2, decor: 1, forest: 1, fireflies: 40 },
  media: { label: 'média', shadowSize: 1024, pcf: 1, maxDpr: 1.5, decor: 0.6, forest: 0.55, fireflies: 24 },
  baixa: { label: 'baixa', shadowSize: 1024, pcf: 0, maxDpr: 1, decor: 0.3, forest: 0.35, fireflies: 12 },
};
export const QUALITY_ORDER = ['alta', 'media', 'baixa'];

export function defaultQuality() {
  if (params.has('quality') && QUALITY_PRESETS[params.get('quality')]) return params.get('quality');
  return PLATFORM.touch ? 'media' : 'alta';
}

/**
 * Safe-area insets (notches, rounded corners, home indicator) in CSS pixels,
 * read from a hidden probe element that uses env(safe-area-inset-*). The app
 * shell also reports the insets it knows about in window.sitioNativeInsets
 * (some Android WebViews leave env() at zero); the larger value wins.
 */
let probe = null;
export function readSafeArea() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
      + 'padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);'
      + 'padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);';
    document.body.appendChild(probe);
  }
  const s = window.getComputedStyle(probe);
  const native = window.sitioNativeInsets || {};
  const pick = (css, side) => Math.max(parseFloat(css) || 0, Number(native[side]) || 0);
  return {
    top: pick(s.paddingTop, 'top'),
    right: pick(s.paddingRight, 'right'),
    bottom: pick(s.paddingBottom, 'bottom'),
    left: pick(s.paddingLeft, 'left'),
  };
}
