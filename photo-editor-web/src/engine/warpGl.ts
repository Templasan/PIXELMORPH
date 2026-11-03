import { warpField, warpRows, WARP_COLUMNS, type WarpSample } from '../domain/layers';

const VERTEX = `#version 300 es
in vec2 pos;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0); gl_Position.y = -gl_Position.y; }`;
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D image;
in vec2 vUv;
out vec4 color;
void main() { color = texture(image, vUv); }`;

let shared: {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  pos: WebGLBuffer;
  uv: WebGLBuffer;
  indices: WebGLBuffer;
  uvAttr: number;
  posAttr: number;
  grid: string;
  count: number;
} | null = null;

function setup() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  shared = {
    gl,
    canvas,
    pos: gl.createBuffer()!,
    uv: gl.createBuffer()!,
    indices: gl.createBuffer()!,
    posAttr: gl.getAttribLocation(program, 'pos'),
    uvAttr: gl.getAttribLocation(program, 'uv'),
    grid: '',
    count: 0,
  };
  return shared;
}

/** Offsets are worked out once per version of the samples: other layers redraw far more often. */
const fields = new WeakMap<readonly WarpSample[], { key: string; field: Float32Array }>();

/** Bends what is on `ctx` in place. Without WebGL the picture stays as it is. */
export function drawWarp(ctx: CanvasRenderingContext2D, samples: readonly WarpSample[], w: number, h: number, opacity: number) {
  const s = setup();
  if (!s || samples.length === 0) return;
  const { gl, canvas } = s;
  const cols = WARP_COLUMNS;
  const rows = warpRows(w, h);
  const key = `${cols}x${rows}|${w}x${h}`;
  let cached = fields.get(samples);
  if (cached?.key !== key) {
    cached = { key, field: warpField(samples, cols, rows, w, h) };
    fields.set(samples, cached);
  }
  // shortcut: a picture past the GPU's texture limit bends at that limit; tile it if a phone hits this.
  const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const fit = Math.min(1, limit / Math.max(ctx.canvas.width, ctx.canvas.height));
  canvas.width = Math.max(1, Math.round(ctx.canvas.width * fit));
  canvas.height = Math.max(1, Math.round(ctx.canvas.height * fit));
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);

  if (s.grid !== `${cols}x${rows}`) {
    s.grid = `${cols}x${rows}`;
    const pos = new Float32Array((cols + 1) * (rows + 1) * 2);
    for (let r = 0, i = 0; r <= rows; r += 1)
      for (let c = 0; c <= cols; c += 1, i += 2) {
        pos[i] = c / cols;
        pos[i + 1] = r / rows;
      }
    gl.bindBuffer(gl.ARRAY_BUFFER, s.pos);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    const indices = new Uint16Array(cols * rows * 6);
    for (let r = 0, i = 0; r < rows; r += 1)
      for (let c = 0; c < cols; c += 1) {
        const a = r * (cols + 1) + c;
        const b = a + cols + 1;
        indices.set([a, b, a + 1, a + 1, b, b + 1], i);
        i += 6;
      }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, s.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    s.count = indices.length;
  }
  const uv = new Float32Array(cached.field.length);
  for (let r = 0, i = 0; r <= rows; r += 1)
    for (let c = 0; c <= cols; c += 1, i += 2) {
      uv[i] = c / cols + cached.field[i] / w;
      uv[i + 1] = r / rows + cached.field[i + 1] / h;
    }
  gl.bindBuffer(gl.ARRAY_BUFFER, s.uv);
  gl.bufferData(gl.ARRAY_BUFFER, uv, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(s.uvAttr);
  gl.vertexAttribPointer(s.uvAttr, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, s.pos);
  gl.enableVertexAttribArray(s.posAttr);
  gl.vertexAttribPointer(s.posAttr, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, s.indices);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawElements(gl.TRIANGLES, s.count, gl.UNSIGNED_SHORT, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = opacity;
  ctx.drawImage(canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
