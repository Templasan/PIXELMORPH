/**
 * RF-041/RF-028: a second GPU pass, chained after the color-adjustments shader (see
 * `@modules/photo-editor/color`), that adds retro effects (aging/grain/vignette) and
 * procedural overlay textures from PixelMorph's internal repository (light leak, dust,
 * wear scratches). Kept in its own module/shader — a separate concern from US-04's
 * color grading — and composed declaratively by nesting <Shader> nodes in the screen.
 */

export interface RetroAdjustments {
  aging: number; // 0..100 — envelhecimento
  agingBlend: number; // 0..100 — mesclagem
  grain: number; // 0..100 — granulado
  grainBlend: number; // 0..100 — mesclagem
  vignette: number; // 0..100 — vinheta
  vignetteBlend: number; // 0..100 — mesclagem
}

export const DEFAULT_RETRO: RetroAdjustments = {
  aging: 0,
  agingBlend: 100,
  grain: 0,
  grainBlend: 100,
  vignette: 0,
  vignetteBlend: 100,
};

/** RF-028: overlayType selects one of the internal repository's procedural textures. */
export const OVERLAY_TEXTURE_NAMES = ['Nenhum', 'Luz', 'Poeira', 'Desgaste'] as const;

export interface OverlayTextureAdjustments {
  type: number; // 0=none, 1=luz, 2=poeira, 3=desgaste
  intensity: number; // 0..100 — how strong the pattern itself is
  opacity: number; // 0..100 — how much of it shows over the photo
}

export const DEFAULT_OVERLAY_TEXTURE: OverlayTextureAdjustments = {
  type: 0,
  intensity: 60,
  opacity: 0,
};

export interface RetroUniforms {
  retroAging: number;
  retroAgingBlend: number;
  retroGrain: number;
  retroGrainBlend: number;
  retroVignette: number;
  retroVignetteBlend: number;
  overlayType: number;
  overlayIntensity: number;
  overlayOpacity: number;
  frameWidth: number;
  frameHeight: number;
  [key: string]: number;
}

export function toRetroUniforms(
  retro: RetroAdjustments,
  overlay: OverlayTextureAdjustments,
  frameWidth: number,
  frameHeight: number
): RetroUniforms {
  return {
    retroAging: retro.aging / 100,
    retroAgingBlend: retro.agingBlend / 100,
    retroGrain: retro.grain / 100,
    retroGrainBlend: retro.grainBlend / 100,
    retroVignette: retro.vignette / 100,
    retroVignetteBlend: retro.vignetteBlend / 100,
    overlayType: overlay.type,
    overlayIntensity: overlay.intensity / 100,
    overlayOpacity: overlay.opacity / 100,
    frameWidth,
    frameHeight,
  };
}

export const RETRO_EFFECTS_SKSL = `
uniform shader image;
uniform float retroAging;
uniform float retroAgingBlend;
uniform float retroGrain;
uniform float retroGrainBlend;
uniform float retroVignette;
uniform float retroVignetteBlend;
uniform float overlayType;
uniform float overlayIntensity;
uniform float overlayOpacity;
uniform float frameWidth;
uniform float frameHeight;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

half4 main(vec2 pos) {
  vec4 c = image.eval(pos);
  if (c.a < 0.0001) {
    return c;
  }
  vec3 rgb = c.rgb / c.a;

  // RF-041: envelhecimento — sepia tint with lifted blacks, classic faded-print look.
  if (retroAgingBlend > 0.0001) {
    float g = dot(rgb, vec3(0.299, 0.587, 0.114));
    vec3 sepia = vec3(g * 1.07, g * 0.86, g * 0.62);
    vec3 aged = mix(rgb, sepia, retroAging);
    aged = clamp(aged * (1.0 - retroAging * 0.15) + retroAging * 0.06, 0.0, 1.0);
    rgb = mix(rgb, aged, retroAgingBlend);
  }

  // RF-041: granulado — procedural per-pixel luminance grain.
  if (retroGrainBlend > 0.0001) {
    float n = hash(pos) - 0.5;
    vec3 grained = clamp(rgb + n * retroGrain * 0.6, 0.0, 1.0);
    rgb = mix(rgb, grained, retroGrainBlend);
  }

  // RF-041: vinheta — radial darkening measured from the frame's own center, so it
  // rotates/flips together with the photo instead of staying fixed to the screen.
  if (retroVignetteBlend > 0.0001) {
    vec2 center = vec2(frameWidth, frameHeight) * 0.5;
    float maxDist = length(center);
    float dist = maxDist > 0.0001 ? length(pos - center) / maxDist : 0.0;
    float fall = smoothstep(0.35, 1.05, dist) * retroVignette;
    rgb = mix(rgb, clamp(rgb * (1.0 - fall), 0.0, 1.0), retroVignetteBlend);
  }

  // RF-028: procedural overlay textures from the internal repository (no external asset
  // files needed — each one is genuinely rendered per-pixel on the GPU).
  if (overlayType > 0.5 && overlayOpacity > 0.0001) {
    vec3 overlayColor = rgb;
    float mask = 0.0;
    if (overlayType < 1.5) {
      // Luz — warm light-leak gradient bleeding in from one corner.
      vec2 uv = vec2(pos.x / max(frameWidth, 1.0), pos.y / max(frameHeight, 1.0));
      float d = distance(uv, vec2(0.88, 0.12));
      mask = (1.0 - smoothstep(0.0, 0.95, d)) * overlayIntensity;
      overlayColor = vec3(1.0, 0.75, 0.35);
    } else if (overlayType < 2.5) {
      // Poeira — sparse bright specks, density scales with intensity.
      float n = hash(floor(pos * 1.6));
      mask = step(0.986 - overlayIntensity * 0.05, n);
      overlayColor = vec3(1.0);
    } else {
      // Desgaste — thin broken scratch streaks running down the frame.
      float col = floor(pos.x / 2.5);
      float r = hash(vec2(col, 13.0));
      float dash = hash(vec2(col, floor(pos.y / 5.0)));
      mask = step(0.965 - overlayIntensity * 0.06, r) * step(0.35, dash);
      overlayColor = vec3(0.88);
    }
    rgb = mix(rgb, clamp(overlayColor, 0.0, 1.0), mask * overlayOpacity);
  }

  return half4(clamp(rgb, 0.0, 1.0) * c.a, c.a);
}
`;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** CPU mirror of the shader's aging stage, for deterministic unit tests. */
export function applyAgingRGB(
  r: number,
  g: number,
  b: number,
  amount: number,
  blend: number
): [number, number, number] {
  const gY = 0.299 * r + 0.587 * g + 0.114 * b;
  const sepia: [number, number, number] = [gY * 1.07, gY * 0.86, gY * 0.62];
  const aged: [number, number, number] = [
    clamp01((r + (sepia[0] - r) * amount) * (1 - amount * 0.15) + amount * 0.06),
    clamp01((g + (sepia[1] - g) * amount) * (1 - amount * 0.15) + amount * 0.06),
    clamp01((b + (sepia[2] - b) * amount) * (1 - amount * 0.15) + amount * 0.06),
  ];
  return [r + (aged[0] - r) * blend, g + (aged[1] - g) * blend, b + (aged[2] - b) * blend];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** CPU mirror of the shader's vignette stage — returns the [0,1] darkening multiplier. */
export function vignetteFactor(
  pos: { x: number; y: number },
  width: number,
  height: number,
  amount: number
): number {
  const center = { x: width / 2, y: height / 2 };
  const maxDist = Math.hypot(center.x, center.y);
  if (maxDist < 0.0001) return 1;
  const dist = Math.hypot(pos.x - center.x, pos.y - center.y) / maxDist;
  const fall = smoothstep(0.35, 1.05, dist) * amount;
  return clamp01(1 - fall);
}
