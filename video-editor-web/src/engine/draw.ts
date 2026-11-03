import type { VideoSample } from 'mediabunny';
import type { Box, CompositionOp, MediaOp } from '../domain/composition';
import { renderSphere } from './sphereGl';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Draws one frame. The only drawing code: preview, seek and export all come through here.
 * `frameOf` gives the decoded sample (video) or picture (image) of a media op, null when it has
 * none yet; such a layer is skipped for this frame. `boxes` receives where each clip landed, in
 * frame pixels (the preview's handles sit on them).
 */
export function drawFrame(
  ctx: Ctx2D,
  width: number,
  height: number,
  ops: readonly CompositionOp[],
  frameOf: (op: MediaOp) => VideoSample | ImageBitmap | null,
  boxes?: Map<string, Box>
) {
  for (const op of ops) {
    ctx.save();
    if (op.kind === 'clear') {
      ctx.fillStyle = op.color;
      ctx.fillRect(0, 0, width, height);
    } else if (op.kind === 'caption') {
      ctx.globalCompositeOperation = op.blend;
      const box = drawCaption(ctx, op, width, height);
      boxes?.set(op.clipId, box);
    } else {
      ctx.globalCompositeOperation = op.blend;
      const frame = frameOf(op);
      if (frame) {
        const box = drawMedia(ctx, op, frame);
        if (box && op.role === 'in') boxes?.set(op.clipId, box);
      }
    }
    ctx.restore();
  }
}

/** RF-021: the video's picture seen from the clip's view, on a canvas of the shape it will show at. */
function sphereFrame(op: MediaOp, frame: VideoSample | ImageBitmap): OffscreenCanvas | null {
  const sample = 'displayWidth' in frame ? frame : null;
  const sw = sample ? sample.displayWidth : (frame as ImageBitmap).width;
  const sh = sample ? sample.displayHeight : (frame as ImageBitmap).height;
  if (!sw || !sh) return null;
  sphereSource ??= new OffscreenCanvas(sw, sh);
  if (sphereSource.width !== sw || sphereSource.height !== sh) {
    sphereSource.width = sw;
    sphereSource.height = sh;
  }
  const source = sphereSource.getContext('2d')!;
  if (sample) sample.draw(source, 0, 0, sw, sh);
  else source.drawImage(frame as ImageBitmap, 0, 0, sw, sh);
  const flat = op.sphere!.flat;
  const width = flat ? Math.max(2, Math.round(op.rect.w)) : sw;
  const height = flat ? Math.max(2, Math.round(op.rect.w * (9 / 16))) : sh;
  return renderSphere(sphereSource, width, height, op.sphere!);
}
let sphereSource: OffscreenCanvas | null = null;

function drawMedia(ctx: Ctx2D, op: MediaOp, original: VideoSample | ImageBitmap): Box | null {
  const frame = (op.sphere && sphereFrame(op, original)) || original;
  const sample = 'displayWidth' in frame ? frame : null;
  const sw = sample ? sample.displayWidth : (frame as ImageBitmap).width;
  const sh = sample ? sample.displayHeight : (frame as ImageBitmap).height;
  if (!sw || !sh) return null;
  // Everything fits by the box around the turned picture, so turning never makes it jump.
  const turn = (op.rotationDeg * Math.PI) / 180;
  const iw = sw * Math.abs(Math.cos(turn)) + sh * Math.abs(Math.sin(turn));
  const ih = sw * Math.abs(Math.sin(turn)) + sh * Math.abs(Math.cos(turn));
  // A PiP window is as wide as asked and as tall as the picture is, from its top-left corner.
  const rect = op.window ? { ...op.rect, h: op.rect.w * (ih / iw) } : op.rect;
  const k = (op.fit === 'cover' && !op.window ? Math.max : Math.min)(rect.w / iw, rect.h / ih);
  const w = sw * k;
  const h = sh * k;
  // The box clips its content: a "cover" layer or a slide never spills outside it.
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.globalAlpha = op.opacity;
  if (op.brightness !== 1) ctx.filter = `brightness(${op.brightness})`;
  ctx.translate(rect.x + rect.w / 2 + op.translateX, rect.y + rect.h / 2);
  ctx.scale(op.scale, op.scale);
  ctx.rotate(turn);
  if (sample) sample.draw(ctx, -w / 2, -h / 2, w, h);
  else ctx.drawImage(frame as ImageBitmap | OffscreenCanvas, -w / 2, -h / 2, w, h);
  if (op.border) {
    // Inside the picture's edge: the box would cut half of a centred line.
    const px = op.border.px / op.scale;
    ctx.filter = 'none';
    ctx.lineWidth = px;
    ctx.strokeStyle = op.border.color;
    ctx.strokeRect(-w / 2 + px / 2, -h / 2 + px / 2, w - px, h - px);
  }
  // A cropped picture is as big as its box, not as big as what was cut off.
  const shownW = Math.min(iw * k, rect.w);
  const shownH = Math.min(ih * k, rect.h);
  return {
    x: rect.x + (rect.w - shownW) / 2,
    y: rect.y + (rect.h - shownH) / 2,
    w: shownW,
    h: shownH,
    rotation: 0,
    aspect: ih / iw,
  };
}

/** Splits `text` into lines no wider than `maxWidth` (words kept whole unless one is wider). */
function wrapLines(ctx: Ctx2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

function drawCaption(
  ctx: Ctx2D,
  op: Extract<CompositionOp, { kind: 'caption' }>,
  frameWidth: number,
  frameHeight: number
): Box {
  ctx.globalAlpha = op.opacity;
  ctx.font = `bold ${op.fontPx}px ${op.fontFamily}`;
  ctx.textAlign = op.align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // Wrapped at 90% of the frame so a long text stays inside it (same in preview and export).
  const lines = wrapLines(ctx, op.text, (frameWidth * 0.9) / Math.max(0.01, op.scale));
  const lineH = op.fontPx * 1.2;
  // A block of several lines is pulled back inside the frame instead of running off an edge.
  const half = (lines.length * lineH * op.scale) / 2;
  const margin = frameHeight * 0.02;
  // The resting place is kept inside; a slide animation still enters from outside.
  const rest = op.cy - op.offsetY;
  const cy =
    (half * 2 + margin * 2 >= frameHeight
      ? frameHeight / 2
      : Math.min(Math.max(rest, half + margin), frameHeight - half - margin)) + op.offsetY;
  // The lines line up on an edge of the block; the block stays centred on the text's position.
  const fullLines = wrapLines(ctx, op.content, (frameWidth * 0.9) / Math.max(0.01, op.scale));
  const widest = Math.max(...fullLines.map((l) => ctx.measureText(l).width));
  const x = op.align === 'left' ? -widest / 2 : op.align === 'right' ? widest / 2 : 0;
  ctx.translate(op.cx, cy);
  ctx.rotate((op.rotationDeg * Math.PI) / 180);
  ctx.scale(op.scale, op.scale);
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
      ctx.strokeText(line, x, y);
      ctx.shadowColor = 'transparent'; // one shadow, cast by the outline
    }
    ctx.fillStyle = op.color;
    ctx.fillText(line, x, y);
    ctx.shadowColor = 'transparent';
  });
  const w = Math.max(op.fontPx, widest) * op.scale;
  return { x: op.cx - w / 2, y: cy - half, w, h: half * 2, rotation: op.rotationDeg };
}
