// Thin WebGL2 helpers: programs, meshes, render targets. Errors name what failed.
export type GL = WebGL2RenderingContext;

export interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

export function program(gl: GL, name: string, vs: string, fs: string): Program {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const numbered = src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");
      throw new Error(`shader ${name} (${type === gl.VERTEX_SHADER ? "vs" : "fs"}) failed: ${log}\n${numbered}`);
    }
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program ${name} link failed: ${gl.getProgramInfoLog(p)}`);
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)!;
    const key = info.name.replace(/\[0\]$/, "");
    u[key] = gl.getUniformLocation(p, info.name);
  }
  return { prog: p, u };
}

export interface Attr {
  loc: number;
  size: number;
  type: number;
  normalized: boolean;
  data: ArrayBufferView<ArrayBuffer>;
  divisor?: number;
  integer?: boolean;
}

export interface Mesh {
  vao: WebGLVertexArrayObject;
  count: number;
  buffers: WebGLBuffer[];
  index?: WebGLBuffer;
  indexType?: number;
}

export function mesh(gl: GL, attrs: Attr[], count: number, indices?: Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>): Mesh {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buffers: WebGLBuffer[] = [];
  for (const a of attrs) {
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, a.data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(a.loc);
    if (a.integer) gl.vertexAttribIPointer(a.loc, a.size, a.type, 0, 0);
    else gl.vertexAttribPointer(a.loc, a.size, a.type, a.normalized, 0, 0);
    if (a.divisor) gl.vertexAttribDivisor(a.loc, a.divisor);
    buffers.push(b);
  }
  let index: WebGLBuffer | undefined;
  let indexType: number | undefined;
  if (indices) {
    index = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    indexType = indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  }
  gl.bindVertexArray(null);
  return { vao, count: indices ? indices.length : count, buffers, index, indexType };
}

export function deleteMesh(gl: GL, m: Mesh): void {
  for (const b of m.buffers) gl.deleteBuffer(b);
  if (m.index) gl.deleteBuffer(m.index);
  gl.deleteVertexArray(m.vao);
}

export function drawMesh(gl: GL, m: Mesh, instances = 0): void {
  gl.bindVertexArray(m.vao);
  if (m.index) {
    if (instances > 0) gl.drawElementsInstanced(gl.TRIANGLES, m.count, m.indexType!, 0, instances);
    else gl.drawElements(gl.TRIANGLES, m.count, m.indexType!, 0);
  } else if (instances > 0) gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, instances);
  else gl.drawArrays(gl.TRIANGLES, 0, m.count);
}

export function texture(gl: GL, w: number, h: number, internal: number, format: number, type: number, filter: number = gl.NEAREST): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export interface Target {
  fbo: WebGLFramebuffer;
  color: WebGLTexture[];
  depth?: WebGLTexture;
  w: number;
  h: number;
}

/** A framebuffer with `colors` RGBA8 attachments and an optional sampleable 24-bit depth texture. */
export function target(gl: GL, w: number, h: number, colors: number, withDepth: boolean, filter: number = gl.NEAREST): Target {
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  const color: WebGLTexture[] = [];
  for (let i = 0; i < colors; i++) {
    const t = texture(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, filter);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
    color.push(t);
  }
  let depth: WebGLTexture | undefined;
  if (withDepth) {
    depth = texture(gl, w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  }
  if (colors > 0) gl.drawBuffers(color.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  else gl.drawBuffers([gl.NONE]);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`framebuffer ${w}x${h} incomplete: 0x${status.toString(16)}`);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, color, depth, w, h };
}

export function deleteTarget(gl: GL, t: Target): void {
  for (const c of t.color) gl.deleteTexture(c);
  if (t.depth) gl.deleteTexture(t.depth);
  gl.deleteFramebuffer(t.fbo);
}
