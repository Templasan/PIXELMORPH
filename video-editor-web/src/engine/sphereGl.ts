import { sphereMatrix, type SphereView } from '../domain/sphere';

const VERTEX = `#version 300 es
in vec2 a;
out vec2 p;
void main() { p = vec2(a.x, -a.y) * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;

// The same maths as domain/sphere.ts sourceUv, per pixel.
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform mat3 turn;
uniform bool flat_;
uniform float halfTan;
uniform float aspect;
in vec2 p;
out vec4 color;
const float PI = 3.14159265358979;
void main() {
  vec3 ray;
  if (flat_) {
    ray = vec3((p.x * 2.0 - 1.0) * halfTan, (1.0 - p.y * 2.0) * halfTan / aspect, 1.0);
  } else {
    float lon = (p.x - 0.5) * 2.0 * PI;
    float lat = (0.5 - p.y) * PI;
    ray = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
  }
  vec3 r = turn * ray;
  vec2 uv = vec2(atan(r.x, r.z) / (2.0 * PI) + 0.5, 0.5 - asin(r.y / length(r)) / PI);
  // No mip level from the jump at the seam: it would draw a line where the picture wraps.
  color = textureLod(image, uv, 0.0);
}`;

let shared: { gl: WebGL2RenderingContext; canvas: OffscreenCanvas; program: WebGLProgram } | null = null;

function setup() {
  if (shared) return shared;
  const canvas = new OffscreenCanvas(2, 2);
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
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
  gl.bindAttribLocation(program, 0, 'a');
  gl.linkProgram(program);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // Sideways the picture wraps around the sphere; at the poles it stops.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  shared = { gl, canvas, program };
  return shared;
}

/** The view of `source`, `width` x `height`. Null without WebGL: the clip then shows unrolled. */
export function renderSphere(source: TexImageSource, width: number, height: number, view: SphereView): OffscreenCanvas | null {
  const s = setup();
  if (!s) return null;
  const { gl, canvas, program } = s;
  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.uniformMatrix3fv(gl.getUniformLocation(program, 'turn'), false, sphereMatrix(view));
  gl.uniform1i(gl.getUniformLocation(program, 'flat_'), view.flat ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(program, 'halfTan'), Math.tan((view.fov * Math.PI) / 360));
  gl.uniform1f(gl.getUniformLocation(program, 'aspect'), width / height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return canvas;
}
