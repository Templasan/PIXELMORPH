import type { VideoSample } from 'mediabunny';
import type { CompositionOp, MediaOp } from '../domain/composition';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Draws one frame. The only drawing code: preview, seek and export all come through here.
 * `frameOf` gives the decoded sample (video) or picture (image) of a media op, null when it has
 * none yet; such a layer is skipped for this frame.
 */
export function drawFrame(
  ctx: Ctx2D,
  width: number,
  height: number,
  ops: readonly CompositionOp[],
  frameOf: (op: MediaOp) => VideoSample | ImageBitmap | null
) {
  for (const op of ops) {
    ctx.save();
    if (op.kind === 'clear') {
      ctx.fillStyle = op.color;
      ctx.fillRect(0, 0, width, height);
    } else if (op.kind === 'caption') {
      drawCaption(ctx, op);
    } else {
      const frame = frameOf(op);
      if (frame) drawMedia(ctx, op, frame);
    }
    ctx.restore();
  }
}

function drawMedia(ctx: Ctx2D, op: MediaOp, frame: VideoSample | ImageBitmap) {
  const sample = 'displayWidth' in frame ? frame : null;
  const sw = sample ? sample.displayWidth : (frame as ImageBitmap).width;
  const sh = sample ? sample.displayHeight : (frame as ImageBitmap).height;
  if (!sw || !sh) return;
  const quarter = Math.abs(op.rotationDeg) % 180 === 90;
  const iw = quarter ? sh : sw;
  const ih = quarter ? sw : sh;
  const k = (op.fit === 'cover' ? Math.max : Math.min)(op.rect.w / iw, op.rect.h / ih);
  const [w, h] = quarter ? [ih * k, iw * k] : [iw * k, ih * k];
  // The box clips its content: a "cover" layer or a slide never spills outside it.
  ctx.beginPath();
  ctx.rect(op.rect.x, op.rect.y, op.rect.w, op.rect.h);
  ctx.clip();
  ctx.globalAlpha = op.opacity;
  if (op.brightness !== 1) ctx.filter = `brightness(${op.brightness})`;
  ctx.translate(op.rect.x + op.rect.w / 2 + op.translateX, op.rect.y + op.rect.h / 2);
  ctx.scale(op.scale, op.scale);
  ctx.rotate((op.rotationDeg * Math.PI) / 180);
  if (sample) sample.draw(ctx, -w / 2, -h / 2, w, h);
  else ctx.drawImage(frame as ImageBitmap, -w / 2, -h / 2, w, h);
}

function drawCaption(ctx: Ctx2D, op: Extract<CompositionOp, { kind: 'caption' }>) {
  ctx.globalAlpha = op.opacity;
  ctx.font = `bold ${op.fontPx}px ${op.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.translate(op.cx, op.cy);
  ctx.scale(op.scale, op.scale);
  const lines = op.text.split('\n');
  const lineH = op.fontPx * 1.2;
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lineH;
    if (op.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = op.fontPx * 0.12;
      ctx.shadowOffsetY = op.fontPx * 0.04;
    }
    if (op.strokePx > 0) {
      ctx.lineWidth = op.strokePx * 2; // half of a centred stroke is hidden under the fill
      ctx.strokeStyle = op.strokeColor;
      ctx.strokeText(line, 0, y);
      ctx.shadowColor = 'transparent'; // one shadow, cast by the outline
    }
    ctx.fillStyle = op.color;
    ctx.fillText(line, 0, y);
    ctx.shadowColor = 'transparent';
  });
}
