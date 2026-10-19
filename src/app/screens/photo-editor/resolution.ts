// Pure size math for the editor's preview proxy and full-resolution export. No Skia import,
// so Jest can test it directly.

/** Long edge of the on-screen proxy: the live canvas never draws more pixels than this. */
export const PREVIEW_LONG_EDGE = 2048;
/** Long edge cap for an export: keeps the offscreen surface within GPU limits. */
export const EXPORT_MAX_LONG_EDGE = 8192;

/** Size of an image scaled down so its long edge is at most `maxLongEdge`, aspect kept. */
export function fitLongEdgeOf(
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxLongEdge) return { width, height };
  const s = maxLongEdge / long;
  return { width: Math.round(width * s), height: Math.round(height * s) };
}

/**
 * Scale from canvas units (frameW×frameH) to output pixels that draws the photo at its native
 * size. The photo is cover-fitted into the frame, so the frame unit is set by the tighter axis.
 * Capped so the frame's long edge stays within EXPORT_MAX_LONG_EDGE.
 */
export function exportScaleOf(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number
): number {
  // Never below 1: a photo smaller than the frame still exports at least at frame size.
  const native = Math.max(1, Math.min(imageWidth / frameWidth, imageHeight / frameHeight));
  return Math.min(native, EXPORT_MAX_LONG_EDGE / Math.max(frameWidth, frameHeight));
}
