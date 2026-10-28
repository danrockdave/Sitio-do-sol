/**
 * WebGL2 context creation and canvas resizing.
 * The canvas element is the only thing the browser provides; every pixel
 * of the game is drawn by WebGL calls.
 */

export function createContext(canvas, { preserveDrawingBuffer = false } = {}) {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    depth: true,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer,
    powerPreference: 'high-performance',
  });
  if (!gl) {
    throw new Error('WebGL 2 não está disponível neste navegador ou aparelho.');
  }
  const anisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
  gl.anisotropic = anisotropic
    ? { ext: anisotropic, max: Math.min(8, gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) }
    : null;
  return gl;
}

/** Keeps the drawing buffer matched to the canvas CSS size times the device pixel ratio. */
export function resizeCanvas(gl, canvas, maxDpr = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, dpr };
}
