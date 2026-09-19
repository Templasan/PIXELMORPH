/**
 * RF-075: dupla exposição — combine two images with a real GPU blend mode and adjustable
 * per-image transparency. The second image comes from PixelMorph's own project library
 * (a real MediaAsset, not a mock) — see EffectsDrawer's "Dupla exposição" tab, which lists
 * the user's other projects to pick from.
 */

export const BLEND_MODES = ['multiply', 'screen', 'overlay'] as const;
export type DoubleExposureBlendMode = (typeof BLEND_MODES)[number];
export const BLEND_MODE_LABELS = ['Multiplicar', 'Tela', 'Sobrepor'];

export const DEFAULT_DOUBLE_EXPOSURE_BLEND = 1; // 'screen' — the most common double-exposure look
export const DEFAULT_DOUBLE_EXPOSURE_OPACITY = 50;

export function blendModeAt(index: number): DoubleExposureBlendMode {
  const i = Math.max(0, Math.min(BLEND_MODES.length - 1, Math.round(index)));
  return BLEND_MODES[i];
}
