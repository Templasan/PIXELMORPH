import type { ArtStyle } from '../domain/layers';

const VERTEX = `#version 300 es
in vec2 a;
out vec2 uv;
void main() { uv = vec2(a.x, -a.y) * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;

/** Each sector's mean and spread; the calmest sector wins, which flattens areas and keeps edges. */
const KUWAHARA = `
vec3 kuwahara(vec2 uv) {
  const int N = 4;
  vec3 best = vec3(0.0);
  float bestSpread = 1e9;
  for (int q = 0; q < 4; q++) {
    vec2 dir = vec2(q == 0 || q == 3 ? -1.0 : 1.0, q < 2 ? -1.0 : 1.0);
    vec3 sum = vec3(0.0);
    vec3 sq = vec3(0.0);
    for (int y = 0; y <= N; y++) {
      for (int x = 0; x <= N; x++) {
        vec3 c = texture(image, uv + dir * vec2(x, y) * step_).rgb;
        sum += c;
        sq += c * c;
      }
    }
    float n = float((N + 1) * (N + 1));
    vec3 mean = sum / n;
    vec3 v = sq / n - mean * mean;
    float spread = v.r + v.g + v.b;
    if (spread < bestSpread) {
      bestSpread = spread;
      best = mean;
    }
  }
  return best;
}`;

const COMMON = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform vec2 step_;
uniform vec2 px;
in vec2 uv;
out vec4 color;
float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
float edge(vec2 uv, vec2 d) {
  float h = luma(texture(image, uv + vec2(d.x, 0.0)).rgb) - luma(texture(image, uv - vec2(d.x, 0.0)).rgb);
  float v = luma(texture(image, uv + vec2(0.0, d.y)).rgb) - luma(texture(image, uv - vec2(0.0, d.y)).rgb);
  return length(vec2(h, v));
}`;

const FRAGMENT: Record<ArtStyle, string> = {
  oil: `${COMMON}${KUWAHARA}
void main() {
  vec3 c = kuwahara(uv);
  color = vec4(mix(vec3(luma(c)), c, 1.15) * (1.0 - edge(uv, step_ * 2.0) * 0.25), texture(image, uv).a);
}`,
  watercolor: `${COMMON}${KUWAHARA}
void main() {
  vec3 c = kuwahara(uv);
  c = mix(vec3(luma(c)), c, 1.2);
  // Pigment pools at the edges of a wash, and white paper shows through the rest.
  c = mix(c, vec3(1.0), 0.18);
  c *= 1.0 - smoothstep(0.02, 0.25, edge(uv, step_ * 3.0)) * 0.45;
  c *= 0.96 + 0.04 * grain(floor(uv * px / 3.0));
  color = vec4(c, texture(image, uv).a);
}`,
  charcoal: `${COMMON}
void main() {
  float e = smoothstep(0.03, 0.3, edge(uv, step_ * 2.0));
  float tone = smoothstep(0.1, 0.9, luma(texture(image, uv).rgb));
  float stick = 0.88 + 0.12 * grain(floor(uv * px / 2.0));
  float shade = mix(0.35, 1.0, tone) * stick;
  float paper = clamp(shade * (1.0 - e * 0.95), 0.0, 1.0);
  color = vec4(vec3(paper * 0.95 + 0.03), texture(image, uv).a);
}`,
};

let shared: {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  programs: Partial<Record<ArtStyle, WebGLProgram>>;
} | null = null;

function programOf(gl: WebGL2RenderingContext, s: NonNullable<typeof shared>, style: ArtStyle) {
  const cached = s.programs[style];
  if (cached) return cached;
  const shader = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT[style]));
  gl.bindAttribLocation(program, 0, 'a');
  gl.linkProgram(program);
  s.programs[style] = program;
  return program;
}

function setup() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  shared = { gl, canvas, programs: {} };
  return shared;
}

/** The filter's reach per sample in scene units: the same look on the screen and in the file. */
const STEP_UNITS = 0.9;

/** Repaints what is on `ctx` in a style. Without WebGL the picture stays as it is. */
export function drawArt(ctx: CanvasRenderingContext2D, style: ArtStyle, opacity: number) {
  const s = setup();
  if (!s) return;
  const { gl, canvas } = s;
  const k = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
  // shortcut: a picture past the GPU's texture limit is painted at that limit; tile it if a phone hits this.
  const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const fit = Math.min(1, limit / Math.max(ctx.canvas.width, ctx.canvas.height));
  canvas.width = Math.max(1, Math.round(ctx.canvas.width * fit));
  canvas.height = Math.max(1, Math.round(ctx.canvas.height * fit));
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);
  const program = programOf(gl, s, style);
  gl.useProgram(program);
  const reach = STEP_UNITS * k * fit;
  gl.uniform2f(gl.getUniformLocation(program, 'step_'), reach / canvas.width, reach / canvas.height);
  gl.uniform2f(gl.getUniformLocation(program, 'px'), canvas.width / k, canvas.height / k);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = opacity;
  ctx.drawImage(canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
