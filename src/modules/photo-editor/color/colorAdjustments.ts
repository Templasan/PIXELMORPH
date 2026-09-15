/**
 * RF-047: real color-grading pipeline (exposure, temperature, hue, saturation,
 * luminosity, vibrance). The same math exists twice on purpose:
 *  - `ADJUSTMENTS_SKSL` runs on the GPU (via Skia RuntimeEffect) to render the photo.
 *  - `applyAdjustmentsRGB` runs on the CPU, over a cached raw pixel buffer, to compute
 *    the live histogram without reading the GPU-rendered frame back on every slider tick.
 * Keeping them in lock-step is why the formulas below are so literal/unrolled.
 */

export interface BasicAdjustments {
  temperatura: number; // -100..100
  matiz: number; // -100..100
  saturacao: number; // -100..100
  luminosidade: number; // -100..100
  vibracao: number; // -100..100
  exposicao: number; // -3..3 (stops)
}

export interface AdjustmentUniforms {
  exposure: number;
  temperature: number;
  hueShift: number;
  saturation: number;
  luminosity: number;
  vibrance: number;
  [key: string]: number;
}

/** RF-063: sharpening (unsharp mask) and noise reduction, both real spatial GPU passes. */
export interface DetailAdjustments {
  nitidez: number; // 0..100
  raio: number; // 0..5 — sharpen sample radius
  reducaoRuido: number; // 0..100 — full-RGB blur blend
  luminancia: number; // 0..100 — luma-only blur blend (preserves chroma detail)
}

export const DEFAULT_DETAIL: DetailAdjustments = {
  nitidez: 0,
  raio: 1,
  reducaoRuido: 0,
  luminancia: 0,
};

/** RF-059: keep one hue band saturated while desaturating the rest. */
export interface SelectiveColorAdjustments {
  colorIndex: number | null; // index into SELECTIVE_HUES; null = feature inactive
  tolerancia: number; // 0..100 — hue-band width
  matiz: number; // -100..100 — hue shift applied only inside the band
  saturacao: number; // -100..100
  luminosidade: number; // -100..100
}

export const SELECTIVE_COLOR_NAMES = [
  'Vermelho',
  'Laranja',
  'Amarelo',
  'Verde',
  'Ciano',
  'Azul',
  'Magenta',
] as const;
// Degrees on the hue wheel matching SELECTIVE_COLOR_NAMES, in order.
export const SELECTIVE_HUES_DEG = [0, 30, 55, 120, 185, 225, 300];

export const DEFAULT_SELECTIVE: SelectiveColorAdjustments = {
  colorIndex: null,
  tolerancia: 50,
  matiz: 0,
  saturacao: 0,
  luminosidade: 0,
};

export interface FullAdjustmentUniforms extends AdjustmentUniforms {
  sharpenAmount: number;
  sharpenRadius: number;
  noiseReduction: number;
  lumaNoiseReduction: number;
  selectiveActive: number; // 0 or 1 — SkSL has no booleans in uniforms
  selectiveHue: number;
  selectiveTolerance: number;
  selectiveDesaturateOthers: number;
  selectiveHueShift: number;
  selectiveSaturation: number;
  selectiveLuminosity: number;
}

const MAX_HUE_SHIFT_TURNS = 60 / 360;

export function toUniforms(a: BasicAdjustments): AdjustmentUniforms {
  return {
    exposure: a.exposicao,
    temperature: a.temperatura / 100,
    hueShift: (a.matiz / 100) * MAX_HUE_SHIFT_TURNS,
    saturation: a.saturacao / 100,
    luminosity: (a.luminosidade / 100) * 0.5,
    vibrance: a.vibracao / 100,
  };
}

export function toFullUniforms(
  basic: BasicAdjustments,
  detail: DetailAdjustments,
  selective: SelectiveColorAdjustments
): FullAdjustmentUniforms {
  const active = selective.colorIndex !== null;
  const hueDeg = active ? SELECTIVE_HUES_DEG[selective.colorIndex as number] : 0;
  return {
    ...toUniforms(basic),
    sharpenAmount: detail.nitidez / 100,
    sharpenRadius: 1.5 + (detail.raio / 5) * 8.5,
    noiseReduction: detail.reducaoRuido / 100,
    lumaNoiseReduction: detail.luminancia / 100,
    selectiveActive: active ? 1 : 0,
    selectiveHue: hueDeg / 360,
    // 0.02..0.27 of the hue wheel (~7deg..~97deg) — wide enough to be usable, never the full wheel.
    selectiveTolerance: 0.02 + (selective.tolerancia / 100) * 0.25,
    selectiveDesaturateOthers: active ? 1 : 0,
    selectiveHueShift: (selective.matiz / 100) * 0.15,
    selectiveSaturation: selective.saturacao / 100,
    selectiveLuminosity: (selective.luminosidade / 100) * 0.5,
  };
}

export const ADJUSTMENTS_SKSL = `
uniform shader image;
uniform float exposure;
uniform float temperature;
uniform float hueShift;
uniform float saturation;
uniform float luminosity;
uniform float vibrance;
uniform float sharpenAmount;
uniform float sharpenRadius;
uniform float noiseReduction;
uniform float lumaNoiseReduction;
uniform float selectiveActive;
uniform float selectiveHue;
uniform float selectiveTolerance;
uniform float selectiveDesaturateOthers;
uniform float selectiveHueShift;
uniform float selectiveSaturation;
uniform float selectiveLuminosity;

const float NOISE_BLUR_STEP = 6.0;

half4 blur3x3(vec2 pos, float dist) {
  half4 sum = half4(0.0);
  sum += image.eval(pos + vec2(-dist, -dist));
  sum += image.eval(pos + vec2(0.0, -dist));
  sum += image.eval(pos + vec2(dist, -dist));
  sum += image.eval(pos + vec2(-dist, 0.0));
  sum += image.eval(pos);
  sum += image.eval(pos + vec2(dist, 0.0));
  sum += image.eval(pos + vec2(-dist, dist));
  sum += image.eval(pos + vec2(0.0, dist));
  sum += image.eval(pos + vec2(dist, dist));
  return sum / 9.0;
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 rgb2hsl(vec3 col) {
  float maxc = max(max(col.r, col.g), col.b);
  float minc = min(min(col.r, col.g), col.b);
  float l = (maxc + minc) * 0.5;
  float d = maxc - minc;
  float h = 0.0;
  float s = 0.0;
  if (d > 0.0001) {
    s = d / (1.0 - abs(2.0 * l - 1.0));
    if (col.r >= col.g && col.r >= col.b) {
      h = mod((col.g - col.b) / d, 6.0);
    } else if (col.g >= col.b) {
      h = (col.b - col.r) / d + 2.0;
    } else {
      h = (col.r - col.g) / d + 4.0;
    }
    h = h / 6.0;
    if (h < 0.0) h += 1.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0 / 2.0) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  if (s < 0.0001) {
    return vec3(l, l, l);
  }
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hue2rgb(p, q, h + 1.0 / 3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0 / 3.0)
  );
}

half4 main(vec2 pos) {
  vec4 c = image.eval(pos);
  if (c.a < 0.0001) {
    return c;
  }
  vec3 rgb = c.rgb / c.a;

  // RF-063: noise reduction (full-RGB blur blend, then a luma-only blend that preserves
  // chroma detail) followed by sharpening (classic unsharp mask).
  if (noiseReduction > 0.0001) {
    vec3 blurred = blur3x3(pos, NOISE_BLUR_STEP).rgb;
    rgb = mix(rgb, blurred, noiseReduction);
  }
  if (lumaNoiseReduction > 0.0001) {
    vec3 blurred = blur3x3(pos, NOISE_BLUR_STEP).rgb;
    float lumaOrig = luma(rgb);
    float lumaBlur = luma(blurred);
    rgb += mix(lumaOrig, lumaBlur, lumaNoiseReduction) - lumaOrig;
  }
  if (sharpenAmount > 0.0001) {
    vec3 blurred = blur3x3(pos, sharpenRadius).rgb;
    rgb += sharpenAmount * (rgb - blurred);
  }
  rgb = clamp(rgb, 0.0, 1.0);

  rgb *= pow(2.0, exposure);
  rgb.r += temperature * 0.15;
  rgb.b -= temperature * 0.15;
  rgb = clamp(rgb, 0.0, 1.0);

  vec3 hsl = rgb2hsl(rgb);
  hsl.x = fract(hsl.x + hueShift);

  float vibBoost = vibrance * (1.0 - hsl.y);
  hsl.y = clamp(hsl.y + vibBoost, 0.0, 1.0);
  hsl.y = clamp(hsl.y * (1.0 + saturation), 0.0, 1.0);
  hsl.z = clamp(hsl.z + luminosity, 0.0, 1.0);

  // RF-059: keep a chosen hue band saturated while desaturating everything else.
  if (selectiveActive > 0.5) {
    float hueDist = abs(hsl.x - selectiveHue);
    hueDist = min(hueDist, 1.0 - hueDist);
    float inBand = 1.0 - smoothstep(selectiveTolerance * 0.5, max(selectiveTolerance, 0.001), hueDist);
    float desat = mix(1.0, 1.0 - selectiveDesaturateOthers, 1.0 - inBand);
    hsl.y = clamp(hsl.y * desat, 0.0, 1.0);
    hsl.x = fract(hsl.x + selectiveHueShift * inBand);
    hsl.y = clamp(hsl.y + selectiveSaturation * inBand, 0.0, 1.0);
    hsl.z = clamp(hsl.z + selectiveLuminosity * inBand, 0.0, 1.0);
  }

  rgb = hsl2rgb(hsl);
  return half4(rgb * c.a, c.a);
}
`;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const l = (maxc + minc) / 2;
  const d = maxc - minc;
  if (d < 0.0001) return [0, 0, l];

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (r >= g && r >= b) {
    h = ((g - b) / d) % 6;
  } else if (g >= b) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  h /= 6;
  if (h < 0) h += 1;
  return [h, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s < 0.0001) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** CPU mirror of ADJUSTMENTS_SKSL's main(), operating on normalized [0,1] RGB. */
export function applyAdjustmentsRGB(
  r: number,
  g: number,
  b: number,
  u: AdjustmentUniforms
): [number, number, number] {
  let rr = r * Math.pow(2, u.exposure);
  let gg = g * Math.pow(2, u.exposure);
  let bb = b * Math.pow(2, u.exposure);
  rr += u.temperature * 0.15;
  bb -= u.temperature * 0.15;
  rr = clamp01(rr);
  gg = clamp01(gg);
  bb = clamp01(bb);

  let [h, s, l] = rgbToHsl(rr, gg, bb);
  h = (h + u.hueShift) % 1;
  if (h < 0) h += 1;

  const vibBoost = u.vibrance * (1 - s);
  s = clamp01(s + vibBoost);
  s = clamp01(s * (1 + u.saturation));
  l = clamp01(l + u.luminosity);

  return hslToRgb(h, s, l);
}
