import type { PaintStroke } from './Layer';

/**
 * US-06: changes what is under this layer, only where its mask lets it through. The mask is a
 * painted area, a colour of the picture, or a linear or radial gradient. Selective focus is the
 * radial mask turned inside out, with blur.
 */
export type LocalMaskKind = 'brush' | 'color' | 'linear' | 'radial';

export interface LocalAdjust {
  mask: LocalMaskKind;
  /** brush: the painted area, in scene units. */
  strokes: PaintStroke[];
  /** Normalized point: the colour to pick, the centre, or a point on the gradient's line. */
  x: number;
  y: number;
  /** color: how far from the picked colour still counts, 0..100. */
  tolerance: number;
  /** linear: the direction the effect grows toward, in degrees (0 = right, 90 = down). */
  angle: number;
  /** radial: as a share of the picture's width. */
  radius: number;
  /** linear and radial: the soft part, 0..1. */
  feather: number;
  invert: boolean;
  /** -100..100 */
  brightness: number;
  contrast: number;
  saturation: number;
  /** Scene units. */
  blur: number;
}

export function createLocalAdjust(mask: LocalMaskKind): LocalAdjust {
  return {
    mask,
    strokes: [],
    x: 0.5,
    y: 0.5,
    tolerance: 25,
    angle: 90,
    radius: 0.3,
    feather: 0.5,
    invert: false,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
  };
}

/** RF-045: everything but the point around (x, y) goes gradually out of focus. */
export function createFocusAdjust(): LocalAdjust {
  return { ...createLocalAdjust('radial'), invert: true, blur: 6, radius: 0.25, feather: 0.6 };
}

/** The canvas filter of the changes; `k` is device pixels per scene unit. */
export function localFilter(l: LocalAdjust, k: number): string {
  const parts = [
    `brightness(${1 + l.brightness / 100})`,
    `contrast(${1 + l.contrast / 100})`,
    `saturate(${1 + l.saturation / 100})`,
  ];
  if (l.blur > 0) parts.push(`blur(${l.blur * k}px)`);
  return parts.join(' ');
}

/** RF-038: how much of a pixel the colour mask takes, 0..1, with a soft edge past the tolerance. */
export function colorMaskAlpha(
  r: number,
  g: number,
  b: number,
  target: readonly [number, number, number],
  tolerance: number
): number {
  const distance = Math.hypot(r - target[0], g - target[1], b - target[2]) / 441.68;
  const limit = tolerance / 100;
  const soft = 0.05 + limit * 0.25;
  return Math.max(0, Math.min(1, (limit + soft - distance) / soft));
}

/** RF-072: the two ends of a linear gradient, in the units of `w` and `h`: 0 at from, 1 at to. */
export function linearMaskEnds(l: LocalAdjust, w: number, h: number) {
  const rad = (l.angle * Math.PI) / 180;
  const half = (Math.max(0.02, l.feather) * Math.hypot(w, h)) / 2;
  const cx = l.x * w;
  const cy = l.y * h;
  return {
    from: { x: cx - Math.cos(rad) * half, y: cy - Math.sin(rad) * half },
    to: { x: cx + Math.cos(rad) * half, y: cy + Math.sin(rad) * half },
  };
}
