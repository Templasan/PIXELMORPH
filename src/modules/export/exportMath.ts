/**
 * Pure export math — deliberately Skia-free so it's unit-testable (this codebase's Skia
 * bindings are native-only and unavailable under Jest/Node, same reason colorAdjustments.ts
 * keeps its CPU mirrors free of any `@shopify/react-native-skia` import).
 */

/** Formats Skia's own encoder produces. */
export const IMAGE_FORMATS = ['JPEG', 'PNG', 'WebP'] as const;
export type SkiaImageFormat = (typeof IMAGE_FORMATS)[number];
/** RF-057: HEIC comes from the native encoder on Android 9+ only (see heicExport.ts). */
export type ImageExportFormat = SkiaImageFormat | 'HEIC';

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

/** Watermark margin from the image edge, as a fraction of the image width. */
export const WATERMARK_MARGIN_RATIO = 0.03;

/**
 * The tab's size slider (5..80) is a fraction of the image width, so the preview box and the
 * exported image show the same proportion of text.
 */
export function watermarkFontSize(imageWidth: number, sizeSlider: number): number {
  return (imageWidth * sizeSlider) / 400;
}

/**
 * Dark shadow under the watermark text, shared by the tab preview and the exported image.
 * `offset` is the down-right shift, `blur` the blur radius (both scale with the font size) and
 * `alpha` the black's opacity before the watermark opacity is applied.
 */
export function watermarkShadow(fontSize: number): { offset: number; blur: number; alpha: number } {
  return { offset: fontSize * 0.02, blur: fontSize * 0.04, alpha: 0.6 };
}

export interface WatermarkPlacement {
  fontSize: number;
  /** Left edge of the text, in image pixels. */
  x: number;
  /** Baseline of the text, in image pixels. */
  baselineY: number;
  /** Centre of the text box, the point the watermark rotates around. */
  pivotX: number;
  pivotY: number;
}

/**
 * `position` is the 3x3 grid of the tab, row by row: 0 top-left ... 4 centre ... 8 bottom-right.
 */
export function layoutWatermark(
  imageWidth: number,
  imageHeight: number,
  textWidth: number,
  fontSize: number,
  position: number
): WatermarkPlacement {
  const cell = Math.min(8, Math.max(0, Math.round(position)));
  const col = cell % 3;
  const row = Math.floor(cell / 3);
  const margin = imageWidth * WATERMARK_MARGIN_RATIO;
  const x =
    col === 0 ? margin : col === 1 ? (imageWidth - textWidth) / 2 : imageWidth - margin - textWidth;
  const top =
    row === 0 ? margin : row === 1 ? (imageHeight - fontSize) / 2 : imageHeight - margin - fontSize;
  return {
    fontSize,
    x,
    baselineY: top + fontSize * 0.8,
    pivotX: x + textWidth / 2,
    pivotY: top + fontSize / 2,
  };
}
