import { ADJUSTMENTS_SKSL } from '../domain/color/colorAdjustments';
import { RETRO_EFFECTS_SKSL } from '../domain/effects/retroEffects';
import { blendModeAt, BLEND_MODES } from '../domain/effects/doubleExposure';
import { invertMat3, type Mat3 } from '../domain/geometry/homography';
import { adjustmentUniforms, perspectiveMatrixOf, retroUniformsOf } from '../domain/adjustments';
import type { Adjustments } from '../domain/adjustments';
import { skslToGlsl } from './sksl';

/** A second picture blended over the photo (double exposure, a gallery overlay). */
export interface BlendImage {
  image: TexImageSource & { width: number; height: number };
  /** BLEND_MODES index. */
  blend: number;
  /** 0..1 */
  opacity: number;
}

export interface PhotoPassInput {
  adjustments: Adjustments;
  /** The "Ajustes de cor" layer: hidden shows the photo without its colour work. */
  adjustmentsVisible: boolean;
  /** The photo's rect in scene units (domain/sceneSize.ts). */
  units: { w: number; h: number };
  blends: BlendImage[];
}

const VERTEX = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

/** Blends `top` (cover-fitted over the rect) onto `image` like Skia's blend modes + opacity. */
const BLEND_FS = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform sampler2D top;
uniform vec4 topUv;
uniform float mode;
uniform float opacity;
uniform vec2 uPx;
out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uPx;
  vec4 b = texture(image, uv);
  vec4 t = texture(top, topUv.xy + uv * topUv.zw);
  vec3 bc = b.a > 0.0 ? b.rgb / b.a : vec3(0.0);
  vec3 tc = t.a > 0.0 ? t.rgb / t.a : vec3(0.0);
  vec3 m;
  if (mode < 0.5) m = bc * tc;
  else if (mode < 1.5) m = 1.0 - (1.0 - bc) * (1.0 - tc);
  else m = mix(2.0 * bc * tc, 1.0 - 2.0 * (1.0 - bc) * (1.0 - tc), step(0.5, bc));
  float k = opacity * t.a;
  fragColor = vec4(mix(bc, m, k) * b.a, b.a);
}`;

/** Draws `image` through a projective matrix (output units -> source units); outside is clear. */
const WARP_FS = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform mat3 inv;
uniform vec2 uUnits;
uniform vec2 uPx;
out vec4 fragColor;
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uPx.y - gl_FragCoord.y);
  vec3 q = inv * vec3(fc * uUnits / uPx, 1.0);
  vec2 uv = q.xy / q.z / uUnits;
  if (q.z <= 0.0 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) fragColor = vec4(0.0);
  else fragColor = texture(image, uv);
}`;

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

/**
 * The photo's GPU passes: colour adjustments -> retro/overlay textures -> blended pictures ->
 * perspective. Everything else (rotation, mirror, layers, frame) is drawn by engine/scene.ts on
 * a 2D canvas on top of this one's picture. Preview and export each own one: the preview's runs
 * on the light copy, the export's on the original.
 */
export class PhotoGl {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private adjust: Program;
  private retro: Program;
  private blend: Program;
  private warp: Program;
  private source: WebGLTexture | null = null;
  private sourceSize = { w: 0, h: 0 };
  private targets: { tex: WebGLTexture; fbo: WebGLFramebuffer }[] = [];
  private blendTextures = new WeakMap<object, WebGLTexture>();

  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 indisponível');
    this.gl = gl;
    this.adjust = this.compile(skslToGlsl(ADJUSTMENTS_SKSL));
    this.retro = this.compile(skslToGlsl(RETRO_EFFECTS_SKSL));
    this.blend = this.compile(BLEND_FS);
    this.warp = this.compile(WARP_FS);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  /** Largest picture side this GPU takes (the export scales a bigger original down to it). */
  get maxSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
  }

  setSource(image: TexImageSource, w: number, h: number) {
    const gl = this.gl;
    if (this.source) gl.deleteTexture(this.source);
    this.source = this.texture(image);
    this.sourceSize = { w, h };
    this.canvas.width = w;
    this.canvas.height = h;
    for (const t of this.targets) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    }
    this.targets = [this.target(w, h), this.target(w, h)];
  }

  /** Draws the photo's passes into `canvas` (same size as the source). */
  render(input: PhotoPassInput) {
    const gl = this.gl;
    if (!this.source) return;
    const { w, h } = this.sourceSize;
    const units: [number, number] = [input.units.w, input.units.h];
    const a = input.adjustments;
    gl.viewport(0, 0, w, h);
    let current = this.source;
    let next = 0;
    const pass = (p: Program, set: () => void, inputs: WebGLTexture[], toScreen = false) => {
      const out = this.targets[next];
      gl.bindFramebuffer(gl.FRAMEBUFFER, toScreen ? null : out.fbo);
      gl.useProgram(p.program);
      inputs.forEach((tex, i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, tex);
      });
      this.set2(p, 'uUnits', units);
      this.set2(p, 'uPx', [w, h]);
      set();
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!toScreen) {
        current = out.tex;
        next = 1 - next;
      }
    };

    if (input.adjustmentsVisible) {
      const u = adjustmentUniforms(a) as unknown as Record<string, number>;
      pass(this.adjust, () => {
        this.setInt(this.adjust, 'image', 0);
        this.setInt(this.adjust, 'maskImage', 0);
        for (const [k, v] of Object.entries(u)) this.set1(this.adjust, k, v);
      }, [current]);
    }
    const r = retroUniformsOf(a, units[0], units[1]) as unknown as Record<string, number>;
    pass(this.retro, () => {
      this.setInt(this.retro, 'image', 0);
      for (const [k, v] of Object.entries(r)) this.set1(this.retro, k, v);
    }, [current]);
    for (const b of input.blends) {
      const tex = this.blendTexture(b.image);
      // Cover fit: the part of `top` with the rect's shape, centred.
      const ta = b.image.width / b.image.height;
      const ra = w / h;
      const uv = ta > ra ? [(1 - ra / ta) / 2, 0, ra / ta, 1] : [0, (1 - ta / ra) / 2, 1, ta / ra];
      pass(this.blend, () => {
        this.setInt(this.blend, 'image', 0);
        this.setInt(this.blend, 'top', 1);
        gl.uniform4fv(this.loc(this.blend, 'topUv'), uv);
        this.set1(this.blend, 'mode', BLEND_MODES.indexOf(blendModeAt(b.blend)));
        this.set1(this.blend, 'opacity', b.opacity);
      }, [current, tex]);
    }
    const m = perspectiveMatrixOf(a, units[0], units[1]);
    const inv: Mat3 = m ? invertMat3(m) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    pass(this.warp, () => {
      this.setInt(this.warp, 'image', 0);
      // Row-major (Skia's layout): WebGL2 transposes it for us.
      gl.uniformMatrix3fv(this.loc(this.warp, 'inv'), true, inv as unknown as number[]);
    }, [current], true);
  }

  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  private blendTexture(image: BlendImage['image']): WebGLTexture {
    let tex = this.blendTextures.get(image);
    if (!tex) {
      tex = this.texture(image);
      this.blendTextures.set(image, tex);
    }
    return tex;
  }

  private texture(image: TexImageSource): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    this.params();
    return tex;
  }

  private target(w: number, h: number) {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.params();
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo };
  }

  private params() {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private compile(fs: string): Program {
    const gl = this.gl;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(program, 0, 'a');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    return { program, uniforms: new Map() };
  }

  private loc(p: Program, name: string) {
    if (!p.uniforms.has(name)) p.uniforms.set(name, this.gl.getUniformLocation(p.program, name));
    return p.uniforms.get(name)!;
  }
  private set1(p: Program, name: string, v: number) {
    this.gl.uniform1f(this.loc(p, name), v);
  }
  private set2(p: Program, name: string, v: [number, number]) {
    this.gl.uniform2f(this.loc(p, name), v[0], v[1]);
  }
  private setInt(p: Program, name: string, v: number) {
    this.gl.uniform1i(this.loc(p, name), v);
  }
}
