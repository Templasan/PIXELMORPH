import { layoutWatermark, watermarkFontSize, watermarkShadow } from '../domain/export/exportMath';

export interface WatermarkStyle {
  text: string;
  /** 3x3 grid cell, 0 (top-left) to 8 (bottom-right). */
  position: number;
  /** 0..1 */
  opacity: number;
  /** The size slider, 5..80: a fraction of the image width. */
  size: number;
  /** Degrees, about the text's centre. */
  rotation: number;
}

/**
 * Export only (never the preview): white text with a soft dark shadow, placed as the sheet's
 * grid shows it. Draws in the picture's own pixels, so the proportions match at any size.
 */
export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, w: WatermarkStyle) {
  const fontSize = watermarkFontSize(width, w.size);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const place = layoutWatermark(width, height, ctx.measureText(w.text).width, fontSize, w.position);
  const { offset, blur, alpha } = watermarkShadow(fontSize);
  ctx.globalAlpha = w.opacity;
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
  ctx.shadowOffsetX = offset;
  ctx.shadowOffsetY = offset;
  ctx.shadowBlur = blur;
  ctx.translate(place.pivotX, place.pivotY);
  ctx.rotate((w.rotation * Math.PI) / 180);
  ctx.translate(-place.pivotX, -place.pivotY);
  ctx.fillText(w.text, place.x, place.baselineY);
  ctx.restore();
}
