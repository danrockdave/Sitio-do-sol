/**
 * Texture helpers. Pixel data always comes from our own decoders
 * (src/loaders/netpbm.js) or is generated in code as typed arrays.
 */

const FORMATS = {
  1: { internal: 'R8', format: 'RED' },
  2: { internal: 'RG8', format: 'RG' },
  3: { internal: 'RGB8', format: 'RGB' },
  4: { internal: 'RGBA8', format: 'RGBA' },
};

export function createTexture(gl, image, { repeat = true, mipmaps = true, nearest = false } = {}) {
  const fmt = FORMATS[image.channels];
  if (!fmt) throw new Error(`Textura com ${image.channels} canais não suportada`);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl[fmt.internal], image.width, image.height, 0, gl[fmt.format],
    gl.UNSIGNED_BYTE, image.data);
  configure(gl, { repeat, mipmaps, nearest });
  if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);
  texture.width = image.width;
  texture.height = image.height;
  return texture;
}

/** Re-uploads pixels into an existing texture (used by the ground splat map). */
export function updateTexture(gl, texture, image, { mipmaps = false } = {}) {
  const fmt = FORMATS[image.channels];
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl[fmt.internal], image.width, image.height, 0, gl[fmt.format],
    gl.UNSIGNED_BYTE, image.data);
  if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

export function createSolidTexture(gl, rgba) {
  return createTexture(gl, { width: 1, height: 1, channels: 4, data: new Uint8Array(rgba) },
    { repeat: true, mipmaps: false, nearest: true });
}

function configure(gl, { repeat, mipmaps, nearest }) {
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  const minFilter = nearest ? gl.NEAREST : mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
  if (mipmaps && gl.anisotropic) {
    gl.texParameterf(gl.TEXTURE_2D, gl.anisotropic.ext.TEXTURE_MAX_ANISOTROPY_EXT, gl.anisotropic.max);
  }
}
