/**
 * RF-060: molduras e bordas decorativas. Drawn as real Skia vector geometry directly on
 * the canvas (a stroked/rounded rect, an optional drop shadow, an optional gradient paint)
 * rather than a rasterized asset — this module only holds the pure geometry math so it's
 * unit-testable without a GPU.
 */

export const FRAME_STYLES = ['Nenhuma', 'Sólida', 'Arredondada', 'Sombreada', 'Degradê'] as const;
export type FrameStyleName = (typeof FRAME_STYLES)[number];

export interface FrameAdjustments {
  style: number; // index into FRAME_STYLES — 0 means no frame
  thickness: number; // 0..100
  radius: number; // 0..100 — used by the "Arredondada" style
}

export const DEFAULT_FRAME: FrameAdjustments = {
  style: 0,
  thickness: 30,
  radius: 30,
};

/** Up to ~12% of the canvas's shorter side, so a "100%" border never swallows the photo. */
export function frameThicknessPx(thickness: number, shortSide: number): number {
  return (thickness / 100) * shortSide * 0.12;
}

/** Corner radius scales with the border's own thickness so the corner reads as rounded, not clipped. */
export function frameRadiusPx(radius: number, thicknessPx: number): number {
  return (radius / 100) * (thicknessPx * 3 + 16);
}
