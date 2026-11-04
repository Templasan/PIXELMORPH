import type { Adjustments } from '../domain/adjustments';
import { totalRotationRadOf } from '../domain/adjustments';
import { frameRadiusPx, frameThicknessPx } from '../domain/effects/frame';
import { lensReflectionSpots } from '../domain/effects/lighting';
import {
  arrowPath,
  brushTip,
  colorMaskAlpha,
  layerGroups,
  linearMaskEnds,
  localFilter,
  pointsToPath,
  type BrushShape,
  blemishAlpha,
  fixRedEyePixels,
  RED_EYE_RADIUS,
  type Cutout,
  type EditorLayer,
  type FaceRetouch,
  type LayerGroup,
} from '../domain/layers';
import type { SceneSize } from '../domain/sceneSize';
import { coverFitRect } from '../domain/export/exportMath';
import { drawArt } from './artGl';
import { drawWarp } from './warpGl';

/** The brush of the stroke being drawn (application's Brush). */
interface Brush {
  color: string;
  size: number;
  shape: BrushShape;
  opacity: number;
}

export interface SceneInput {
  /** The photo after its GPU passes (PhotoGl.canvas), or any picture of the photo's shape. */
  photo: CanvasImageSource;
  size: SceneSize;
  adjustments: Adjustments;
  layers: EditorLayer[];
  frameColor: string;
  frameGradientColor: string;
  /** The decoded picture of an image layer; a layer without one yet is skipped. */
  pictureOf?: (uri: string) => CanvasImageSource | undefined;
  /** The stroke being drawn (preview only). */
  stroke?: { points: { x: number; y: number }[]; brush: Brush };
}

/**
 * The one drawing path of the finished picture: the preview draws it on screen and the export
 * at full size, so the file is what the screen showed. `ctx` must already be scaled to scene
 * units (scene.w × scene.h).
 */
export function drawScene(ctx: CanvasRenderingContext2D, s: SceneInput) {
  const { scene, photo } = s.size;
  const a = s.adjustments;
  ctx.clearRect(0, 0, scene.w, scene.h);

  // The photo turns (quarter turns + straighten) about the centre; a flip draws a mirrored copy
  // over it at its own opacity.
  ctx.save();
  ctx.translate(scene.w / 2, scene.h / 2);
  ctx.rotate(totalRotationRadOf(a));
  ctx.drawImage(s.photo, -photo.w / 2, -photo.h / 2, photo.w, photo.h);
  if (a.flipH > 0 || a.flipV > 0) {
    // shortcut: the mirrored copy keeps the blended pictures the app left out of it; split the GPU pass if anyone notices.
    ctx.scale(a.flipH > 0 ? -1 : 1, a.flipV > 0 ? -1 : 1);
    ctx.globalAlpha = a.mirrorOpacity / 100;
    ctx.drawImage(s.photo, -photo.w / 2, -photo.h / 2, photo.w, photo.h);
  }
  ctx.restore();

  if (a.lightIntensity > 0) drawLight(ctx, a, scene.w, scene.h);
  for (const group of layerGroups(s.layers)) {
    if (group.base.face) drawFace(ctx, group.base.face, s, group.base.opacity / 100);
    else if (group.base.cutout) drawCutout(ctx, group.base.cutout, s, group.base.opacity / 100);
    else if (group.clipped.length) drawClipped(ctx, group, scene.w, scene.h, s.pictureOf);
    else drawLayer(ctx, group.base, scene.w, scene.h, s.pictureOf);
  }
  if (s.stroke && s.stroke.points.length > 1) {
    const { brush, points } = s.stroke;
    ctx.save();
    stroke(ctx, new Path2D(pointsToPath(points)), brush.color, brush.size, brush.shape, brush.opacity / 100);
    ctx.restore();
  }
  if (a.frameStyle > 0) drawFrame(ctx, a, s.frameColor, s.frameGradientColor, scene.w, scene.h);
}

/**
 * One layer at its opacity and blend. A layer made of several overlapping marks is drawn on its
 * own canvas first, so it blends as one piece instead of mark by mark.
 */
export function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: EditorLayer,
  w: number,
  h: number,
  pictureOf: SceneInput['pictureOf']
) {
  if (layer.local) {
    drawLocal(ctx, layer, w, h);
    return;
  }
  if (layer.art) {
    drawArt(ctx, layer.art, layer.opacity / 100);
    return;
  }
  if (layer.warp) {
    drawWarp(ctx, layer.warp, w, h, layer.opacity / 100);
    return;
  }
  const blend = layer.blend ?? 'source-over';
  const whole = layer.kind === 'image' || (layer.opacity === 100 && blend === 'source-over');
  ctx.save();
  ctx.globalAlpha = layer.opacity / 100;
  ctx.globalCompositeOperation = blend;
  if (whole) drawMarks(ctx, layer, w, h, pictureOf);
  else {
    const buffer = document.createElement('canvas');
    buffer.width = ctx.canvas.width;
    buffer.height = ctx.canvas.height;
    const b = buffer.getContext('2d')!;
    b.setTransform(ctx.getTransform());
    drawMarks(b, layer, w, h, pictureOf);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buffer, 0, 0);
    buffer.width = buffer.height = 0;
  }
  ctx.restore();
}

const CLOSED_SHARE = 0.25;

/** A stroke ending near where it began circles an area, and the inside counts too. */
export function isClosedStroke(path: string): boolean {
  const points = [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
  if (points.length < 8) return false;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(first.x - last.x, first.y - last.y) < span * CLOSED_SHARE;
}

/** The colour mask is worked out at this size: its edges are soft anyway, and it runs per frame. */
const COLOR_MASK_EDGE = 512;

function pixelCanvas(ctx: CanvasRenderingContext2D, width = ctx.canvas.width, height = ctx.canvas.height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d', { willReadFrequently: width !== ctx.canvas.width })!;
}

function drawColorMask(mask: CanvasRenderingContext2D, source: HTMLCanvasElement, l: NonNullable<EditorLayer['local']>) {
  const k = Math.min(1, COLOR_MASK_EDGE / Math.max(source.width, source.height));
  const small = pixelCanvas(mask, Math.max(1, Math.round(source.width * k)), Math.max(1, Math.round(source.height * k)));
  small.drawImage(source, 0, 0, small.canvas.width, small.canvas.height);
  const image = small.getImageData(0, 0, small.canvas.width, small.canvas.height);
  const d = image.data;
  const at = (Math.min(small.canvas.height - 1, Math.floor(l.y * small.canvas.height)) * small.canvas.width +
    Math.min(small.canvas.width - 1, Math.floor(l.x * small.canvas.width))) * 4;
  const target = [d[at], d[at + 1], d[at + 2]] as const;
  for (let i = 0; i < d.length; i += 4) {
    d[i + 3] = 255 * colorMaskAlpha(d[i], d[i + 1], d[i + 2], target, l.tolerance);
  }
  small.putImageData(image, 0, 0);
  mask.save();
  mask.setTransform(1, 0, 0, 1, 0, 0);
  mask.imageSmoothingQuality = 'high';
  mask.drawImage(small.canvas, 0, 0, mask.canvas.width, mask.canvas.height);
  mask.restore();
  small.canvas.width = small.canvas.height = 0;
}

/** US-06: what is under the layer, changed, and let through only where the mask says. */
function drawLocal(ctx: CanvasRenderingContext2D, layer: EditorLayer, w: number, h: number) {
  const l = layer.local!;
  if (l.mask === 'brush' && l.strokes.length === 0) return;
  if (l.remove) {
    // Only shows what is marked: the removal happens when it is applied.
    ctx.save();
    for (const s of l.strokes) {
      ctx.globalAlpha = 0.55;
      const path = new Path2D(s.path);
      stroke(ctx, path, '#E5484D', s.width, s.shape, 1);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#E5484D';
      if (isClosedStroke(s.path)) ctx.fill(path);
    }
    ctx.restore();
    return;
  }
  if (l.clone && !l.offset) return;
  const transform = ctx.getTransform();
  const k = Math.hypot(transform.a, transform.b);

  const mask = pixelCanvas(ctx);
  mask.setTransform(transform);
  if (l.mask === 'brush') {
    // A hard edge would show where the change stops.
    mask.filter = `blur(${(l.clone ? 3 : 1.5) * k}px)`;
    for (const s of l.strokes) {
      mask.globalAlpha = 1;
      stroke(mask, new Path2D(s.path), '#fff', s.width, s.shape, s.opacity);
    }
    mask.filter = 'none';
  } else if (l.mask === 'color') {
    drawColorMask(mask, ctx.canvas, l);
  } else {
    let g: CanvasGradient;
    if (l.mask === 'linear') {
      const { from, to } = linearMaskEnds(l, w, h);
      g = mask.createLinearGradient(from.x, from.y, to.x, to.y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,1)');
    } else {
      const r = Math.max(1, l.radius * w);
      g = mask.createRadialGradient(l.x * w, l.y * h, 0, l.x * w, l.y * h, r);
      g.addColorStop(Math.min(0.99, 1 - l.feather), 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    }
    mask.globalAlpha = 1;
    mask.fillStyle = g;
    mask.fillRect(0, 0, w, h);
  }

  const changed = pixelCanvas(ctx);
  changed.filter = localFilter(l, k);
  changed.drawImage(ctx.canvas, l.offset ? -l.offset.dx * k : 0, l.offset ? -l.offset.dy * k : 0);
  changed.filter = 'none';
  changed.globalCompositeOperation = l.invert ? 'destination-out' : 'destination-in';
  changed.drawImage(mask.canvas, 0, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = layer.opacity / 100;
  ctx.globalCompositeOperation = layer.blend ?? 'source-over';
  ctx.drawImage(changed.canvas, 0, 0);
  ctx.restore();
  mask.canvas.width = mask.canvas.height = 0;
  changed.canvas.width = changed.canvas.height = 0;
}

/** Readback for spot fixes stays this small: skin spots are soft, and this runs on every redraw. */
const FACE_WORK_EDGE = 320;

/**
 * US-25: one face's retouch on what is under the layer. The face turns with the photo. The mask is
 * an ellipse inside the face's box with the eyes and mouth left out, so they stay sharp.
 */
function drawFace(ctx: CanvasRenderingContext2D, f: FaceRetouch, s: SceneInput, opacity: number) {
  const { scene, photo } = s.size;
  const base = ctx.getTransform();
  const k = Math.hypot(base.a, base.b);
  const turn = totalRotationRadOf(s.adjustments);
  const place = (c: CanvasRenderingContext2D) => {
    c.setTransform(base);
    c.translate(scene.w / 2, scene.h / 2);
    c.rotate(turn);
    c.translate(-photo.w / 2, -photo.h / 2);
    c.scale(photo.w, photo.h);
  };
  const layer = () => {
    const canvas = document.createElement('canvas');
    canvas.width = ctx.canvas.width;
    canvas.height = ctx.canvas.height;
    return canvas.getContext('2d')!;
  };
  const free = (...cs: CanvasRenderingContext2D[]) => {
    for (const c of cs) c.canvas.width = c.canvas.height = 0;
  };
  const faceW = f.w * photo.w;
  const eyeRadius = faceW * 0.13;
  const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => {
    c.beginPath();
    c.ellipse(x, y, rx / photo.w, ry / photo.h, 0, 0, Math.PI * 2);
    c.fill();
  };
  const eyesOf = (c: CanvasRenderingContext2D) => {
    for (const e of [f.leftEye, f.rightEye]) if (e) ellipse(c, e.x, e.y, eyeRadius, eyeRadius * 0.62);
  };
  const paste = (from: CanvasRenderingContext2D, operation: GlobalCompositeOperation = 'source-over', alpha = opacity) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = operation;
    ctx.drawImage(from.canvas, 0, 0);
    ctx.restore();
  };

  // Skin: the face's oval, soft at the edge, without the eyes and the mouth.
  const skin = layer();
  place(skin);
  skin.filter = `blur(${faceW * 0.04 * k}px)`;
  skin.fillStyle = '#fff';
  ellipse(skin, f.x + f.w / 2, f.y + f.h / 2, (f.w * photo.w) / 2, (f.h * photo.h) / 2);
  skin.globalCompositeOperation = 'destination-out';
  eyesOf(skin);
  if (f.mouth) ellipse(skin, f.mouth.x, f.mouth.y, f.mouth.w * photo.w * 0.65, f.mouth.w * photo.w * 0.4);
  skin.filter = 'none';

  const blurredCopy = (px: number) => {
    const c = layer();
    c.filter = `blur(${px}px)`;
    c.drawImage(ctx.canvas, 0, 0);
    c.filter = 'none';
    return c;
  };

  if (f.blemishes) {
    // Small dark spots only, at a working size: the fix is a soft patch, not a sharp edit.
    const scale = Math.min(1, FACE_WORK_EDGE / Math.max(1, faceW * k));
    const canvasOf = (src: CanvasImageSource) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(ctx.canvas.width * scale));
      c.height = Math.max(1, Math.round(ctx.canvas.height * scale));
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.drawImage(src, 0, 0, c.width, c.height);
      return x;
    };
    const near = blurredCopy(faceW * 0.03 * k);
    const sharpSmall = canvasOf(ctx.canvas);
    const nearSmall = canvasOf(near.canvas);
    const w = sharpSmall.canvas.width;
    const h = sharpSmall.canvas.height;
    const alpha = blemishAlpha(sharpSmall.getImageData(0, 0, w, h).data, nearSmall.getImageData(0, 0, w, h).data);
    const spots = nearSmall.getImageData(0, 0, w, h);
    for (let p = 0; p < alpha.length; p += 1) spots.data[p * 4 + 3] = alpha[p];
    nearSmall.putImageData(spots, 0, 0);
    const patch = layer();
    patch.filter = `blur(${(0.6 / scale).toFixed(2)}px)`;
    patch.drawImage(nearSmall.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
    patch.filter = 'none';
    patch.globalCompositeOperation = 'destination-in';
    patch.drawImage(skin.canvas, 0, 0);
    paste(patch);
    free(near, patch);
    sharpSmall.canvas.width = sharpSmall.canvas.height = nearSmall.canvas.width = nearSmall.canvas.height = 0;
  }

  if (f.smooth > 0) {
    const soft = blurredCopy((f.smooth / 100) * faceW * 0.022 * k);
    soft.globalCompositeOperation = 'destination-in';
    soft.drawImage(skin.canvas, 0, 0);
    // Never all the way: some of the skin's own texture has to stay, or it looks like plastic.
    paste(soft, 'source-over', opacity * (0.25 + (f.smooth / 100) * 0.4));
    free(soft);
  }

  if (f.tone !== 0) {
    const tint = layer();
    tint.fillStyle = f.tone > 0 ? '#ffb070' : '#70b0ff';
    tint.fillRect(0, 0, tint.canvas.width, tint.canvas.height);
    tint.globalCompositeOperation = 'destination-in';
    tint.drawImage(skin.canvas, 0, 0);
    paste(tint, 'soft-light', opacity * (Math.abs(f.tone) / 100) * 0.6);
    free(tint);
  }

  if (f.redEye) {
    for (const e of [f.leftEye, f.rightEye]) {
      if (!e) continue;
      const cx = (e.x - 0.5) * photo.w;
      const cy = (e.y - 0.5) * photo.h;
      const p = new DOMPoint(cx, cy).matrixTransform(base.translate(scene.w / 2, scene.h / 2).rotate((turn * 180) / Math.PI));
      const r = Math.ceil(faceW * RED_EYE_RADIUS * k);
      const x = Math.max(0, Math.round(p.x - r));
      const y = Math.max(0, Math.round(p.y - r));
      const w = Math.min(ctx.canvas.width - x, r * 2);
      const h = Math.min(ctx.canvas.height - y, r * 2);
      if (w <= 0 || h <= 0) continue;
      const pixels = ctx.getImageData(x, y, w, h);
      fixRedEyePixels(pixels.data);
      ctx.putImageData(pixels, x, y);
    }
  }

  if (f.eyes > 0) {
    const mask = layer();
    place(mask);
    // The eye itself: a wider patch lights up the skin around it.
    mask.filter = `blur(${eyeRadius * 0.15 * k}px)`;
    mask.fillStyle = '#fff';
    for (const p of [f.leftEye, f.rightEye]) if (p) ellipse(mask, p.x, p.y, eyeRadius * 0.7, eyeRadius * 0.35);
    mask.filter = 'none';
    const lit = layer();
    const e = f.eyes / 100;
    lit.filter = `brightness(${1 + e * 0.15}) contrast(${1 + e * 0.3}) saturate(${1 + e * 0.1})`;
    lit.drawImage(ctx.canvas, 0, 0);
    lit.filter = 'none';
    lit.globalCompositeOperation = 'destination-in';
    lit.drawImage(mask.canvas, 0, 0);
    paste(lit);
    free(mask, lit);
  }
  free(skin);
}

/**
 * RF-004: keeps what is under this layer only inside the subject, with the new background behind
 * it. The mask turns with the photo. A perspective correction would not line up with it.
 */
function drawCutout(ctx: CanvasRenderingContext2D, c: Cutout, s: SceneInput, opacity: number) {
  const mask = s.pictureOf?.(c.maskUri);
  if (!mask || opacity <= 0) return;
  const { scene, photo } = s.size;
  // RF-012: the photo's own background, blurred, goes behind the sharp subject.
  let blurred: HTMLCanvasElement | null = null;
  if (c.backBlur) {
    blurred = document.createElement('canvas');
    blurred.width = ctx.canvas.width;
    blurred.height = ctx.canvas.height;
    const b = blurred.getContext('2d')!;
    b.filter = `blur(${c.backBlur * Math.hypot(ctx.getTransform().a, ctx.getTransform().b)}px)`;
    b.drawImage(ctx.canvas, 0, 0);
    // A blur fades out at the picture's edge: the sharp photo fills what it leaves see-through.
    b.filter = 'none';
    b.globalCompositeOperation = 'destination-over';
    b.drawImage(ctx.canvas, 0, 0);
  }
  // What the subject leaves out is the whole picture without it, at the layer's strength.
  const keep = document.createElement('canvas');
  keep.width = ctx.canvas.width;
  keep.height = ctx.canvas.height;
  const k = keep.getContext('2d')!;
  k.setTransform(ctx.getTransform());
  k.translate(scene.w / 2, scene.h / 2);
  k.rotate(totalRotationRadOf(s.adjustments));
  k.drawImage(mask, -photo.w / 2, -photo.h / 2, photo.w, photo.h);
  if (opacity < 1) {
    // A weaker layer keeps some of the old background.
    k.setTransform(1, 0, 0, 1, 0, 0);
    k.globalCompositeOperation = 'destination-over';
    k.globalAlpha = 1 - opacity;
    k.fillRect(0, 0, keep.width, keep.height);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(keep, 0, 0);
  ctx.restore();
  keep.width = keep.height = 0;

  if (blurred) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.drawImage(blurred, 0, 0);
    ctx.restore();
    blurred.width = blurred.height = 0;
    return;
  }
  const back = c.backUri ? s.pictureOf?.(c.backUri) : undefined;
  if (!back && !c.backColor) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  if (back) {
    const b = back as ImageBitmap;
    const r = coverFitRect(b.width, b.height, scene.w, scene.h);
    ctx.drawImage(back, r.x, r.y, r.width, r.height);
  } else {
    ctx.fillStyle = c.backColor!;
    ctx.fillRect(0, 0, scene.w, scene.h);
  }
  ctx.restore();
}

/** A base with the layers clipped to it: they are mixed together, then join the picture as one. */
function drawClipped(
  ctx: CanvasRenderingContext2D,
  { base, clipped }: LayerGroup,
  w: number,
  h: number,
  pictureOf: SceneInput['pictureOf']
) {
  const buffers: HTMLCanvasElement[] = [];
  const buffer = () => {
    const canvas = document.createElement('canvas');
    canvas.width = ctx.canvas.width;
    canvas.height = ctx.canvas.height;
    buffers.push(canvas);
    const b = canvas.getContext('2d')!;
    b.setTransform(ctx.getTransform());
    return b;
  };
  const shape = buffer();
  drawMarks(shape, base, w, h, pictureOf);
  shape.setTransform(1, 0, 0, 1, 0, 0);
  const group = buffer();
  group.setTransform(1, 0, 0, 1, 0, 0);
  group.drawImage(shape.canvas, 0, 0);
  for (const layer of clipped) {
    const marks = buffer();
    drawMarks(marks, layer, w, h, pictureOf);
    marks.setTransform(1, 0, 0, 1, 0, 0);
    marks.globalAlpha = 1;
    marks.globalCompositeOperation = 'destination-in';
    marks.drawImage(shape.canvas, 0, 0);
    group.globalAlpha = layer.opacity / 100;
    group.globalCompositeOperation = layer.blend ?? 'source-over';
    group.drawImage(marks.canvas, 0, 0);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = base.opacity / 100;
  ctx.globalCompositeOperation = base.blend ?? 'source-over';
  ctx.drawImage(group.canvas, 0, 0);
  ctx.restore();
  for (const canvas of buffers) canvas.width = canvas.height = 0;
}

function drawMarks(
  ctx: CanvasRenderingContext2D,
  layer: EditorLayer,
  w: number,
  h: number,
  pictureOf: SceneInput['pictureOf']
) {
  if (layer.kind === 'paint') drawStrokes(ctx, layer);
  else if (layer.kind === 'text' && layer.text) drawText(ctx, layer.text, w, h);
  else if (layer.kind === 'shape' && layer.shape) drawShape(ctx, layer.shape, w, h);
  else if (layer.kind === 'image' && layer.image) {
    const picture = pictureOf?.(layer.image.uri);
    if (picture) drawPicture(ctx, picture, layer.image, w, h);
  }
}

function drawPicture(
  ctx: CanvasRenderingContext2D,
  picture: CanvasImageSource,
  i: NonNullable<EditorLayer['image']>,
  w: number,
  h: number
) {
  const pw = i.size * w;
  const ph = pw / i.aspect;
  ctx.translate(i.x * w, i.y * h);
  ctx.rotate(((i.rotation ?? 0) * Math.PI) / 180);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(picture, -pw / 2, -ph / 2, pw, ph);
}

const LINE_HEIGHT = 1.2;
let measurer: CanvasRenderingContext2D | null = null;

/** The box a layer occupies, in scene units: its centre, size and turn. Null when it has none. */
export function layerBox(layer: EditorLayer, w: number, h: number) {
  if (layer.text) {
    const t = layer.text;
    measurer ??= document.createElement('canvas').getContext('2d')!;
    measurer.font = `bold ${t.fontSize}px ${t.fontFamily}`;
    const lines = t.content.split('\n');
    const width = Math.max(t.fontSize, ...lines.map((l) => measurer!.measureText(l).width));
    return { cx: t.x * w, cy: t.y * h, w: width, h: lines.length * t.fontSize * LINE_HEIGHT, rotation: t.rotation ?? 0 };
  }
  if (layer.shape) {
    const s = layer.shape;
    const side = s.size * w * 2;
    const flat = s.kind === 'line' || s.kind === 'arrow';
    return { cx: s.x * w, cy: s.y * h, w: side, h: flat ? Math.max(16, side * 0.4) : side, rotation: s.rotation ?? 0 };
  }
  if (layer.image) {
    const i = layer.image;
    return { cx: i.x * w, cy: i.y * h, w: i.size * w, h: (i.size * w) / i.aspect, rotation: i.rotation ?? 0 };
  }
  return null;
}

function stroke(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  color: string,
  width: number,
  shape: Brush['shape'] | undefined,
  opacity: number
) {
  const tip = brushTip(shape);
  ctx.lineCap = tip.cap;
  ctx.lineJoin = tip.join;
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.globalAlpha *= opacity;
  ctx.stroke(path);
}

function drawStrokes(ctx: CanvasRenderingContext2D, layer: EditorLayer) {
  const alpha = ctx.globalAlpha;
  for (const s of layer.strokes ?? []) {
    ctx.globalAlpha = alpha;
    stroke(ctx, new Path2D(s.path), s.color, s.width, s.shape, s.opacity);
  }
}

function drawText(ctx: CanvasRenderingContext2D, t: NonNullable<EditorLayer['text']>, w: number, h: number) {
  ctx.font = `bold ${t.fontSize}px ${t.fontFamily}`;
  const align = t.align ?? 'center';
  ctx.textAlign = align;
  // A text saved before alignment existed has no align, and its y is the baseline of its line.
  ctx.textBaseline = t.align ? 'middle' : 'alphabetic';
  ctx.translate(t.x * w, t.y * h);
  ctx.rotate(((t.rotation ?? 0) * Math.PI) / 180);
  const lines = t.content.split('\n');
  const lineH = t.fontSize * LINE_HEIGHT;
  // The lines line up on an edge of the block; the block stays centred on the layer's position.
  const half = Math.max(...lines.map((l) => ctx.measureText(l).width)) / 2;
  const x = align === 'left' ? -half : align === 'right' ? half : 0;
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lineH;
    if (t.shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(line, x + 2, y + 2);
    }
    if (t.strokeWidth > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = t.strokeWidth;
      ctx.strokeStyle = t.strokeColor;
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = t.color;
    ctx.fillText(line, x, y);
  });
}

function drawShape(ctx: CanvasRenderingContext2D, s: NonNullable<EditorLayer['shape']>, w: number, h: number) {
  const cx = 0;
  const cy = 0;
  const r = s.size * w;
  ctx.translate(s.x * w, s.y * h);
  ctx.rotate(((s.rotation ?? 0) * Math.PI) / 180);
  ctx.lineWidth = s.strokeWidth;
  ctx.strokeStyle = s.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (s.kind === 'circle') {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.kind === 'rect') ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
  else if (s.kind === 'line') {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.stroke();
  } else ctx.stroke(new Path2D(arrowPath(cx, cy, r)));
}

function drawLight(ctx: CanvasRenderingContext2D, a: Adjustments, w: number, h: number) {
  const amount = a.lightIntensity / 100;
  const x = a.lightX * w;
  const y = a.lightY * h;
  const base = Math.min(w, h) * (a.lightType === 1 ? 0.22 : 0.32);
  const spots = [{ x, y, radius: base * (0.5 + amount * 0.7), opacity: 0.85 }];
  if (a.lightType === 2) spots.push(...lensReflectionSpots({ x, y }, { x: w / 2, y: h / 2 }, 4));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const spot of spots) {
    const g = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.radius);
    g.addColorStop(0, `rgba(255,255,255,${spot.opacity * amount})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  a: Adjustments,
  color: string,
  gradientColor: string,
  w: number,
  h: number
) {
  const t = Math.max(1, frameThicknessPx(a.frameThickness, Math.min(w, h)));
  const r = a.frameStyle === 2 ? frameRadiusPx(a.frameRadius, t) : 0;
  ctx.save();
  ctx.lineWidth = t;
  if (a.frameStyle === 4) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, color);
    g.addColorStop(1, gradientColor);
    ctx.strokeStyle = g;
  } else ctx.strokeStyle = color;
  if (a.frameStyle === 3) {
    // Skia's blur is a sigma; a canvas shadowBlur is about twice that.
    ctx.shadowBlur = t * 1.6;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
  }
  ctx.beginPath();
  ctx.roundRect(t / 2, t / 2, w - t, h - t, r);
  ctx.stroke();
  ctx.restore();
}
