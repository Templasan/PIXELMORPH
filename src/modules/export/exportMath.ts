/**
 * Pure export math — deliberately Skia-free so it's unit-testable (this codebase's Skia
 * bindings are native-only and unavailable under Jest/Node, same reason colorAdjustments.ts
 * keeps its CPU mirrors free of any `@shopify/react-native-skia` import).
 */

export const IMAGE_FORMATS = ['JPEG', 'PNG', 'WebP'] as const;
export type ImageExportFormat = (typeof IMAGE_FORMATS)[number];

/** RF-057: formats Skia's own encoder can actually produce — no HEIC encoder exists here. */
export const UNSUPPORTED_IMAGE_FORMATS = ['HEIC'] as const;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** RF-017: social presets — real target resolutions, reused for photo export (crop/resize). */
export interface SocialPreset {
  name: string;
  width: number;
  height: number;
}

export const SOCIAL_PRESETS: SocialPreset[] = [
  { name: 'Instagram Feed', width: 1080, height: 1080 },
  { name: 'Instagram Story', width: 1080, height: 1920 },
  { name: 'Twitter / X', width: 1200, height: 675 },
  { name: 'LinkedIn', width: 1200, height: 627 },
];

/**
 * RNF-013: binary-searches for the highest quality whose ACTUAL encoded size (via the
 * injected `sizeAt` probe — real encoder output in production, a fake curve in tests)
 * still fits under `targetBytes`. Returns `maxQuality` if even that already fits, or
 * `minQuality` if nothing fits (the best available compromise).
 */
export function searchQualityForTargetSize(
  targetBytes: number,
  sizeAt: (quality: number) => number,
  minQuality = 20,
  maxQuality = 100
): number {
  if (sizeAt(maxQuality) <= targetBytes) return maxQuality;
  if (sizeAt(minQuality) > targetBytes) return minQuality;

  let lo = minQuality;
  let hi = maxQuality;
  let best = minQuality;
  for (let i = 0; i < 6 && lo <= hi; i++) {
    const mid = Math.round((lo + hi) / 2);
    if (sizeAt(mid) <= targetBytes) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** RF-017: "Tamanho" chips — max long-edge in pixels, aspect ratio preserved (no cropping). */
export interface SizePreset {
  name: string;
  maxLongEdge: number | null; // null = Original (no resize)
}

export const SIZE_PRESETS: SizePreset[] = [
  { name: 'Original', maxLongEdge: null },
  { name: '2K', maxLongEdge: 2048 },
  { name: '1080p', maxLongEdge: 1920 },
  { name: '720p', maxLongEdge: 1280 },
];

/** Scales width/height down (never up) so the longer edge matches maxLongEdge, aspect kept. */
export function scaleToFit(
  width: number,
  height: number,
  maxLongEdge: number | null
): { width: number; height: number } {
  if (maxLongEdge === null) return { width, height };
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** "Cover" fit geometry for resizing/cropping to a target preset — pure math, testable. */
export function coverFitRect(
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number
): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(targetWidth / srcWidth, targetHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}
