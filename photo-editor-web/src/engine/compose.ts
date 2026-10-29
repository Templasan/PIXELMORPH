import { cellPixelRect, type CollageLayout } from '../domain/collage/CollageMath';
import { coverFitRect } from '../domain/export/exportMath';
import type { panoramaLayout } from '../domain/panorama/panoramaLayout';

export interface CollageOptions {
  spacing: number;
  /** Drop shadow under each photo, 0..1 (strength; its blur grows with the spacing). */
  shadow: number;
  borderWidth: number;
  borderColor: string;
}

/** RF-011: each picture cover-fitted into its cell, on the border colour, with spacing/borders. */
export function drawCollage(
  pictures: readonly CanvasImageSource[],
  sizes: readonly { width: number; height: number }[],
  layout: CollageLayout,
  size: number,
  o: CollageOptions
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = o.borderColor;
  ctx.fillRect(0, 0, size, size);
  layout.cells.forEach((cell, i) => {
    const picture = pictures[i];
    if (!picture) return;
    const r = cellPixelRect(cell, size, size, o.spacing);
    const fit = coverFitRect(sizes[i].width, sizes[i].height, r.width, r.height);
    if (o.shadow > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${0.6 * o.shadow})`;
      ctx.shadowBlur = Math.max(4, o.spacing) * 1.5;
      ctx.shadowOffsetY = Math.max(2, o.spacing) * 0.4;
      ctx.fillStyle = o.borderColor;
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.width, r.height);
    ctx.clip();
    ctx.drawImage(picture, r.x + fit.x, r.y + fit.y, fit.width, fit.height);
    ctx.restore();
    if (o.borderWidth > 0) {
      ctx.lineWidth = o.borderWidth;
      ctx.strokeStyle = o.borderColor;
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    }
  });
  return canvas;
}

/** US-28: the photos side by side, each faded in across its overlap with the previous one. */
export function drawPanorama(
  pictures: readonly CanvasImageSource[],
  layout: ReturnType<typeof panoramaLayout>
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d')!;
  const piece = document.createElement('canvas');
  const p = piece.getContext('2d')!;
  layout.rects.forEach((r, i) => {
    piece.width = r.width;
    piece.height = r.height;
    p.drawImage(pictures[i], 0, 0, r.width, r.height);
    if (r.fade > 0) {
      // Alpha ramps from 0 to 1 across the overlap, so the seam blends instead of cutting.
      // destination-in clears whatever the fill does not cover: it covers the whole piece.
      const g = p.createLinearGradient(0, 0, r.width, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(r.fade / r.width, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      p.globalCompositeOperation = 'destination-in';
      p.fillStyle = g;
      p.fillRect(0, 0, r.width, r.height);
      p.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(piece, r.x, r.y);
  });
  piece.width = piece.height = 0;
  return canvas;
}
