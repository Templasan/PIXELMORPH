/**
 * US-25: one face's retouch, as a layer of its own, so each face has its own settings. Positions are
 * normalized to the photo. Every correction here is pixels and geometry; finding the face is ML Kit's.
 */
import type { Point } from '../geometry';

export interface FaceRetouch {
  x: number;
  y: number;
  w: number;
  h: number;
  leftEye: Point | null;
  rightEye: Point | null;
  mouth: { x: number; y: number; w: number } | null;
  /** 0..100 */
  smooth: number;
  /** Brighter, clearer eyes, 0..100. */
  eyes: number;
  /** -100 cooler .. 100 warmer. */
  tone: number;
  /** RF-025 */
  redEye: boolean;
  blemishes: boolean;
}

export interface DetectedFace {
  x: number;
  y: number;
  w: number;
  h: number;
  leftEye: Point | null;
  rightEye: Point | null;
  mouthLeft: Point | null;
  mouthRight: Point | null;
  mouthBottom: Point | null;
}

export function faceRetouchOf(f: DetectedFace): FaceRetouch {
  const { mouthLeft: a, mouthRight: b, mouthBottom: c } = f;
  return {
    x: f.x,
    y: f.y,
    w: f.w,
    h: f.h,
    leftEye: f.leftEye,
    rightEye: f.rightEye,
    mouth: a && b ? { x: (a.x + b.x) / 2, y: c ? (a.y + c.y) / 2 : a.y, w: Math.hypot(a.x - b.x, a.y - b.y) } : null,
    smooth: 35,
    eyes: 0,
    tone: 0,
    redEye: false,
    blemishes: true,
  };
}

/** Bright red against the other two channels: flash in a pupil, not a lip or a red shirt. */
const RED_RATIO = 1.75;
const MIN_RED = 70;

export function isRedEyePixel(r: number, g: number, b: number): boolean {
  return r >= MIN_RED && r > RED_RATIO * ((g + b) / 2);
}

/** Share of a region's pixels that look like red eye, used to switch the fix on by itself. */
export function redEyeShare(rgba: Uint8ClampedArray): number {
  let red = 0;
  for (let i = 0; i < rgba.length; i += 4) if (isRedEyePixel(rgba[i], rgba[i + 1], rgba[i + 2])) red += 1;
  return red / Math.max(1, rgba.length / 4);
}

/** RF-025: takes the red out in place, keeping how dark or bright each pixel was. */
export function fixRedEyePixels(rgba: Uint8ClampedArray) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (isRedEyePixel(rgba[i], rgba[i + 1], rgba[i + 2])) rgba[i] = (rgba[i + 1] + rgba[i + 2]) / 2;
  }
}

/** How much darker than its blurred surroundings a pixel must be to count as a blemish. */
const BLEMISH_DARKER = 14;
/** Past this it is a feature, like an eyebrow or a nostril, and is left alone. */
const FEATURE_DARKER = 55;

/**
 * RF-025: where a small dark spot sits on otherwise even skin: the alpha (0..255) with which the
 * blurred copy should cover each pixel. A real feature is far darker than a blemish, so it stays.
 */
export function blemishAlpha(sharp: Uint8ClampedArray, blurred: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(sharp.length / 4);
  for (let p = 0, i = 0; i < sharp.length; p += 1, i += 4) {
    const luma = 0.3 * sharp[i] + 0.59 * sharp[i + 1] + 0.11 * sharp[i + 2];
    const around = 0.3 * blurred[i] + 0.59 * blurred[i + 1] + 0.11 * blurred[i + 2];
    const darker = around - luma;
    if (darker > BLEMISH_DARKER && darker < FEATURE_DARKER) out[p] = 255;
  }
  return out;
}
