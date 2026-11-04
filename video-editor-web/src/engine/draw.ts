import { poseAt } from '../domain/faceTrack';
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

let faceFrame: OffscreenCanvas | null = null;
let faceWork: OffscreenCanvas | null = null;

/**
 * RF-016: the frame with its faces retouched. The same oval as a photo's, with the eyes and mouth
 * left out so they stay sharp; only the box around each face is worked on, to keep up with playback.
 */
function retouchFaces(op: MediaOp, frame: VideoSample | ImageBitmap): OffscreenCanvas | null {
  const sample = 'displayWidth' in frame ? frame : null;
  const sw = sample ? sample.displayWidth : (frame as ImageBitmap).width;
  const sh = sample ? sample.displayHeight : (frame as ImageBitmap).height;
  if (!sw || !sh) return null;
  const poses = op.faces!.flatMap((track) => {
    const pose = poseAt(track.poses, op.sourceTimeMs);
    return pose && (track.smooth > 0 || track.eyes > 0 || track.tone !== 0) ? [{ track, pose }] : [];
  });
  if (poses.length === 0) return null;
  faceFrame ??= new OffscreenCanvas(sw, sh);
  if (faceFrame.width !== sw || faceFrame.height !== sh) {
    faceFrame.width = sw;
    faceFrame.height = sh;
  }
  const out = faceFrame.getContext('2d')!;
  if (sample) sample.draw(out, 0, 0, sw, sh);
  else out.drawImage(frame as ImageBitmap, 0, 0, sw, sh);
  faceWork ??= new OffscreenCanvas(2, 2);
  for (const { track, pose } of poses) {
    const margin = pose.w * sw * 0.15;
    const x = Math.floor(pose.x * sw - margin);
    const y = Math.floor(pose.y * sh - margin);
    const w = Math.ceil(pose.w * sw + margin * 2);
    const h = Math.ceil(pose.h * sh + margin * 2);
    faceWork.width = w;
    faceWork.height = h;
    const work = faceWork.getContext('2d')!;
    const cx = (pose.x + pose.w / 2) * sw - x;
    const cy = (pose.y + pose.h / 2) * sh - y;
    const faceW = pose.w * sw;
    const eyeRx = faceW * 0.13;
    const hole = (px: number, py: number, rx: number, ry: number) => {
      work.beginPath();
      work.ellipse(px * sw - x, py * sh - y, rx, ry, 0, 0, Math.PI * 2);
      work.fill();
    };
    const skinOnly = () => {
      // Soft oval, by a radial gradient on a squeezed circle: a filter would cost too much per frame.
      work.globalCompositeOperation = 'destination-in';
      work.save();
      work.translate(cx, cy);
      work.scale(1, (pose.h * sh) / (pose.w * sw));
      const g = work.createRadialGradient(0, 0, faceW * 0.32, 0, 0, faceW * 0.5);
      g.addColorStop(0, '#fff');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      work.fillStyle = g;
      work.fillRect(-w, -h * 2, w * 2, h * 4);
      work.restore();
      work.globalCompositeOperation = 'destination-out';
      work.fillStyle = '#000';
      if (pose.leftEye) hole(pose.leftEye.x, pose.leftEye.y, eyeRx, eyeRx * 0.62);
      if (pose.rightEye) hole(pose.rightEye.x, pose.rightEye.y, eyeRx, eyeRx * 0.62);
      if (pose.mouth) hole(pose.mouth.x, pose.mouth.y, pose.mouth.w * sw * 0.65, pose.mouth.w * sw * 0.4);
      work.globalCompositeOperation = 'source-over';
    };
    if (track.smooth > 0) {
      work.filter = `blur(${((track.smooth / 100) * faceW * 0.022).toFixed(2)}px)`;
      work.drawImage(faceFrame, -x, -y);
      work.filter = 'none';
      skinOnly();
      out.globalAlpha = 0.25 + (track.smooth / 100) * 0.4;
      out.drawImage(faceWork, x, y);
      out.globalAlpha = 1;
    }
    if (track.tone !== 0) {
      work.clearRect(0, 0, w, h);
      work.fillStyle = track.tone > 0 ? '#ffb070' : '#70b0ff';
      work.fillRect(0, 0, w, h);
      skinOnly();
      out.globalCompositeOperation = 'soft-light';
      out.globalAlpha = (Math.abs(track.tone) / 100) * 0.6;
      out.drawImage(faceWork, x, y);
      out.globalCompositeOperation = 'source-over';
      out.globalAlpha = 1;
    }
    if (track.eyes > 0) {
      const e = track.eyes / 100;
      out.save();
      out.beginPath();
      for (const p of [pose.leftEye, pose.rightEye]) {
        if (!p) continue;
        out.ellipse(p.x * sw, p.y * sh, eyeRx * 0.7, eyeRx * 0.35, 0, 0, Math.PI * 2);
        out.closePath();
      }
      out.clip();
      out.filter = `brightness(${1 + e * 0.15}) contrast(${1 + e * 0.3}) saturate(${1 + e * 0.1})`;
      out.drawImage(faceFrame, 0, 0);
      out.restore();
    }
  }
  return faceFrame;
}

function drawMedia(ctx: Ctx2D, op: MediaOp, original: VideoSample | ImageBitmap): Box | null {
  const frame = (op.sphere && sphereFrame(op, original)) || (op.faces && retouchFaces(op, original)) || original;
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
