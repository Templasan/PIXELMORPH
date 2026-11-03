/**
 * US-28: where each photo of a panorama goes. Photos are scaled to one height, laid left to
 * right, each overlapping the previous by `overlap` of its own width (one share, or one per photo) (the seam is faded across
 * that strip) and nudged up or down by `offsetsY` (fraction of the height) to line them up. The
 * result keeps only the height every photo covers, so nudging never leaves empty bands.
 */
export interface PanoramaRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Width of the strip at its left edge where it fades in over the previous photo (0 for the first). */
  fade: number;
}

export function panoramaLayout(
  sizes: readonly { width: number; height: number }[],
  height: number,
  overlap: number | readonly number[],
  offsetsY: readonly number[] = []
): { width: number; height: number; rects: PanoramaRect[] } {
  const rects: PanoramaRect[] = [];
  let x = 0;
  sizes.forEach((s, i) => {
    const width = Math.round((s.width * height) / s.height);
    const share = typeof overlap === 'number' ? overlap : (overlap[i] ?? 0);
    const fade = i === 0 ? 0 : Math.round(width * share);
    x -= fade;
    rects.push({ x, y: Math.round((offsetsY[i] ?? 0) * height), width, height, fade });
    x += width;
  });
  const top = Math.max(...rects.map((r) => r.y));
  const bottom = Math.min(...rects.map((r) => r.y + r.height));
  for (const r of rects) r.y -= top;
  return { width: Math.max(0, x), height: Math.max(0, bottom - top), rects };
}
