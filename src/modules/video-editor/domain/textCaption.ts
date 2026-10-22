/**
 * RF-008: text over video. A text clip on a 'text' track carries a ClipText; `captionAt` says how
 * it looks at an instant (position, opacity, scale, letters shown) for the preview AND the export.
 * Pure, no DOM/RN imports.
 */

export type TextAnimation =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom'
  | 'typewriter';

export const TEXT_ANIMATIONS: readonly { id: TextAnimation; label: string }[] = [
  { id: 'none', label: 'Nenhuma' },
  { id: 'fade', label: 'Fade' },
  { id: 'slide-left', label: 'Deslizar ←' },
  { id: 'slide-right', label: 'Deslizar →' },
  { id: 'slide-up', label: 'Deslizar ↑' },
  { id: 'slide-down', label: 'Deslizar ↓' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'typewriter', label: 'Máquina de escrever' },
];

export interface ClipText {
  content: string;
  fontFamily: string;
  color: string;
  /** Height of one line as a fraction of the frame height. */
  size: number;
  /** Centre of the text block, 0..1 of the frame. */
  x: number;
  y: number;
  shadow: boolean;
  strokeColor: string;
  /** Outline width as a fraction of the line height; 0 = none. */
  strokeWidth: number;
  animIn: { type: TextAnimation; ms: number };
  animOut: { type: TextAnimation; ms: number };
}

export const DEFAULT_TEXT: ClipText = {
  content: 'Texto',
  fontFamily: 'sans-serif',
  color: '#ffffff',
  size: 0.08,
  x: 0.5,
  y: 0.82,
  // White with a shadow and an outline reads on light and dark video alike.
  shadow: true,
  strokeColor: '#000000',
  strokeWidth: 0.06,
  animIn: { type: 'fade', ms: 400 },
  animOut: { type: 'fade', ms: 400 },
};

export const MIN_TEXT_SIZE = 0.02;
export const MAX_TEXT_SIZE = 0.4;

/** Distance a slide travels, as a fraction of the frame width (left/right) or height (up/down). */
const SLIDE = 0.25;

export interface CaptionState {
  text: string;
  /** Centre in frame pixels, animation offset included. */
  cx: number;
  cy: number;
  fontPx: number;
  scale: number;
  opacity: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - (1 - p) ** 3;

/**
 * One end of the animation. `p` goes 0 -> 1 as the text appears (or 1 -> 0 as it leaves), so the
 * out animation is the in animation played backwards. Moves apply to the frame of `w`x`h`.
 */
function apply(
  type: TextAnimation,
  p: number,
  s: { dx: number; dy: number; scale: number; opacity: number; letters: number },
  w: number,
  h: number
) {
  const e = easeOut(p);
  switch (type) {
    case 'fade':
      s.opacity *= p;
      break;
    case 'slide-left': // comes in from the right moving left, leaves to the left
      s.dx += (1 - e) * SLIDE * w;
      s.opacity *= p;
      break;
    case 'slide-right':
      s.dx -= (1 - e) * SLIDE * w;
      s.opacity *= p;
      break;
    case 'slide-up':
      s.dy += (1 - e) * SLIDE * h;
      s.opacity *= p;
      break;
    case 'slide-down':
      s.dy -= (1 - e) * SLIDE * h;
      s.opacity *= p;
      break;
    case 'zoom':
      s.scale *= 0.5 + 0.5 * e;
      s.opacity *= p;
      break;
    case 'typewriter':
      s.letters = Math.min(s.letters, p);
      break;
    case 'none':
      break;
  }
}

/**
 * How text `t` (a clip at `startMs` lasting `durationMs`) looks at `timeMs` on a `w`x`h` frame;
 * null when it is not on screen. In and out animations never overlap: on a short clip each gets
 * at most half of it.
 */
export function captionAt(
  t: ClipText,
  startMs: number,
  durationMs: number,
  timeMs: number,
  w: number,
  h: number
): CaptionState | null {
  const into = timeMs - startMs;
  const left = startMs + durationMs - timeMs;
  if (into < 0 || left <= 0 || !t.content.trim()) return null;
  const half = durationMs / 2;
  const inMs = Math.min(t.animIn.ms, half);
  const outMs = Math.min(t.animOut.ms, half);
  const s = { dx: 0, dy: 0, scale: 1, opacity: 1, letters: 1 };
  if (t.animIn.type !== 'none' && inMs > 0 && into < inMs)
    apply(t.animIn.type, clamp01(into / inMs), s, w, h);
  if (t.animOut.type !== 'none' && outMs > 0 && left < outMs) {
    // Leaving mirrors entering: a slide-left leaves to the left, so flip the offset's sign.
    const before = { dx: s.dx, dy: s.dy };
    apply(t.animOut.type, clamp01(left / outMs), s, w, h);
    s.dx = before.dx - (s.dx - before.dx);
    s.dy = before.dy - (s.dy - before.dy);
  }
  const count = Math.ceil(t.content.length * s.letters);
  if (count <= 0 || s.opacity <= 0) return null;
  return {
    text: t.content.slice(0, count),
    cx: t.x * w + s.dx,
    cy: t.y * h + s.dy,
    fontPx: t.size * h,
    scale: s.scale,
    opacity: s.opacity,
  };
}
