/**
 * Off-screen render targets:
 *   - ShadowMap: depth-only framebuffer sampled with hardware comparison (sampler2DShadow)
 *   - IconTarget: small multisampled cell resolved slot by slot into the HUD icon atlas
 */

export class ShadowMap {
  constructor(gl, size = 2048) {
    this.gl = gl;
    this.size = size;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.texture, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Shadow map incompleto (0x${status.toString(16)})`);
  }

  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.size, this.size);
  }
}

export class IconTarget {
  /**
   * Icons are drawn one at a time into a small multisampled cell and blitted
   * into their slot of the atlas texture, so the MSAA buffers stay tiny even
   * when the atlas holds hundreds of icons.
   */
  constructor(gl, width, height, cell) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.cell = cell;
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));

    // multisampled cell we draw each icon into
    this.msaaFramebuffer = gl.createFramebuffer();
    this.colorRenderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.colorRenderbuffer);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, cell, cell);
    this.depthRenderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthRenderbuffer);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, cell, cell);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFramebuffer);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.colorRenderbuffer);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthRenderbuffer);

    // atlas texture sampled by the HUD and the billboards
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(width, height))) + 1, gl.RGBA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.atlasFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.atlasFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    // start fully transparent
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // single-sampled cell: a multisampled blit must keep the same rectangle,
    // so the cell is resolved here first and then copied to its atlas slot
    this.cellTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.cellTexture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, cell, cell);
    this.cellFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cellFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.cellTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Binds and clears the multisampled cell. */
  beginCell() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFramebuffer);
    gl.viewport(0, 0, this.cell, this.cell);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /** Resolves the cell into atlas slot (col, row); row 0 is the bottom of the texture. */
  resolveCell(col, row) {
    const gl = this.gl;
    const c = this.cell;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaaFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.cellFramebuffer);
    gl.blitFramebuffer(0, 0, c, c, 0, 0, c, c, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.cellFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.atlasFramebuffer);
    gl.blitFramebuffer(0, 0, c, c, col * c, row * c, (col + 1) * c, (row + 1) * c, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  /** Builds the mipmaps once every icon is in place. */
  finish() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}
