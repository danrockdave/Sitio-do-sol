/**
 * GLSL program wrapper: compiles, links and caches uniform locations.
 */

export class ShaderProgram {
  constructor(gl, vertexSource, fragmentSource, name = 'shader') {
    this.gl = gl;
    this.name = name;
    const vs = compile(gl, gl.VERTEX_SHADER, vertexSource, `${name}.vert`);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource, `${name}.frag`);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Falha ao ligar o programa ${name}: ${gl.getProgramInfoLog(program)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = program;

    // Cache every active uniform location, arrays by base name ("uPointPos[0]" -> "uPointPos").
    this.uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      const baseName = info.name.replace(/\[0\]$/, '');
      this.uniforms[baseName] = gl.getUniformLocation(program, info.name);
    }
  }

  use() {
    this.gl.useProgram(this.program);
    return this;
  }

  has(name) {
    return this.uniforms[name] !== undefined && this.uniforms[name] !== null;
  }

  set1i(name, value) { const l = this.uniforms[name]; if (l) this.gl.uniform1i(l, value); }
  set1f(name, value) { const l = this.uniforms[name]; if (l) this.gl.uniform1f(l, value); }
  set2f(name, x, y) { const l = this.uniforms[name]; if (l) this.gl.uniform2f(l, x, y); }
  set3fv(name, v) { const l = this.uniforms[name]; if (l) this.gl.uniform3fv(l, v); }
  set4fv(name, v) { const l = this.uniforms[name]; if (l) this.gl.uniform4fv(l, v); }
  set1fv(name, v) { const l = this.uniforms[name]; if (l) this.gl.uniform1fv(l, v); }
  setMat4(name, m) { const l = this.uniforms[name]; if (l) this.gl.uniformMatrix4fv(l, false, m); }
}

function compile(gl, type, source, label) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Erro ao compilar ${label}:\n${log}`);
  }
  return shader;
}
