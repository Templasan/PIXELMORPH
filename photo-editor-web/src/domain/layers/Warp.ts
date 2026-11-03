/**
 * RF-026: liquify. Each sample of a finger's path bends the picture around it. The result is a
 * grid of offsets saying where each point of the output reads from, drawn as a mesh.
 */
export type WarpMode = 'push' | 'pull' | 'twirl';

export interface WarpSample {
  /** Centre, in scene units. */
  x: number;
  y: number;
  /** The finger's move since the last sample, in scene units. */
  dx: number;
  dy: number;
  /** Scene units. */
  radius: number;
  /** 0..1 */
  strength: number;
  mode: WarpMode;
}

/** Quads across the picture's width: fine enough to bend smoothly, small enough to redraw live. */
export const WARP_COLUMNS = 48;

/** How far a pull moves per sample, as a share of the distance to the centre, at full strength. */
const PULL_STEP = 0.12;
/** How far a twirl turns per sample at full strength, in radians. */
const TWIRL_STEP = 0.18;

export function warpRows(w: number, h: number): number {
  return Math.max(2, Math.round((WARP_COLUMNS * h) / w));
}

/** Offsets (dx, dy per vertex, row by row) in scene units; (cols + 1) * (rows + 1) * 2 values. */
export function warpField(samples: readonly WarpSample[], cols: number, rows: number, w: number, h: number): Float32Array {
  const field = new Float32Array((cols + 1) * (rows + 1) * 2);
  for (const s of samples) {
    for (let row = 0, i = 0; row <= rows; row += 1) {
      for (let col = 0; col <= cols; col += 1, i += 2) {
        const vx = (col / cols) * w - s.x;
        const vy = (row / rows) * h - s.y;
        const d2 = vx * vx + vy * vy;
        if (d2 >= s.radius * s.radius) continue;
        const f = (1 - d2 / (s.radius * s.radius)) ** 2 * s.strength;
        if (s.mode === 'push') {
          // The picture moves with the finger, so this point reads from behind it.
          field[i] -= s.dx * f;
          field[i + 1] -= s.dy * f;
        } else if (s.mode === 'pull') {
          // The picture moves toward the centre, so this point reads from farther out.
          field[i] += vx * f * PULL_STEP;
          field[i + 1] += vy * f * PULL_STEP;
        } else {
          const a = f * TWIRL_STEP;
          field[i] += vx * Math.cos(a) - vy * Math.sin(a) - vx;
          field[i + 1] += vx * Math.sin(a) + vy * Math.cos(a) - vy;
        }
      }
    }
  }
  return field;
}
