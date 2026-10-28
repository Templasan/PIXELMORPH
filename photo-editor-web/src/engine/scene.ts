import type { Adjustments } from '../domain/adjustments';
import { totalRotationRadOf } from '../domain/adjustments';
import { frameRadiusPx, frameThicknessPx } from '../domain/effects/frame';
import { lensReflectionSpots } from '../domain/effects/lighting';
import { arrowPath, brushTip, pointsToPath, type BrushShape, type EditorLayer } from '../domain/layers';
import type { SceneSize } from '../domain/sceneSize';

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
  for (const layer of s.layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity / 100;
    if (layer.kind === 'paint') drawStrokes(ctx, layer);
    else if (layer.kind === 'text' && layer.text) drawText(ctx, layer.text, scene.w, scene.h);
    else if (layer.kind === 'shape' && layer.shape) drawShape(ctx, layer.shape, scene.w, scene.h);
    ctx.restore();
  }
  if (s.stroke && s.stroke.points.length > 1) {
    const { brush, points } = s.stroke;
    ctx.save();
    stroke(ctx, new Path2D(pointsToPath(points)), brush.color, brush.size, brush.shape, brush.opacity / 100);
    ctx.restore();
  }
  if (a.frameStyle > 0) drawFrame(ctx, a, s.frameColor, s.frameGradientColor, scene.w, scene.h);
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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const x = t.x * w;
  const y = t.y * h;
  if (t.shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(t.content, x + 2, y + 2);
  }
  if (t.strokeWidth > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = t.strokeWidth;
    ctx.strokeStyle = t.strokeColor;
    ctx.strokeText(t.content, x, y);
  }
  ctx.fillStyle = t.color;
  ctx.fillText(t.content, x, y);
}

function drawShape(ctx: CanvasRenderingContext2D, s: NonNullable<EditorLayer['shape']>, w: number, h: number) {
  const cx = s.x * w;
  const cy = s.y * h;
  const r = s.size * w;
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
