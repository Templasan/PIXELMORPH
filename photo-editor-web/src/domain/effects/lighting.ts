/**
 * RF-068: efeitos de iluminação (flare, brilho, reflexo lenticular), manually positioned.
 * Rendered as real Skia radial-gradient circles composited with a "screen" blend mode —
 * this module holds only the pure geometry (light position -> the points/radii Skia draws)
 * so the placement math is unit-testable without a GPU.
 */

export const LIGHT_TYPES = ['Flare', 'Brilho', 'Reflexo lenticular'] as const;
export type LightTypeName = (typeof LIGHT_TYPES)[number];

export interface LightAdjustments {
  type: number; // index into LIGHT_TYPES
  x: number; // 0..1, normalized position within the canvas
  y: number; // 0..1
  intensity: number; // 0..100
}

export const DEFAULT_LIGHT: LightAdjustments = {
  type: 0,
  x: 0.78,
  y: 0.22,
  intensity: 0,
};

export interface LightSpot {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

/**
 * RF-068 (reflexo lenticular): classic lens-flare ghosting — secondary spots along the
 * line from the light source, through the frame's center, and out the other side,
 * shrinking and fading the further they travel from the source.
 */
export function lensReflectionSpots(
  light: { x: number; y: number },
  center: { x: number; y: number },
  count: number
): LightSpot[] {
  const dx = center.x - light.x;
  const dy = center.y - light.y;
  const spots: LightSpot[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    spots.push({
      x: light.x + dx * (1 + t),
      y: light.y + dy * (1 + t),
      radius: 6 + (1 - t) * 18,
      opacity: 0.35 * (1 - t * 0.6),
    });
  }
  return spots;
}
