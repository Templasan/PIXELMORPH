/**
 * RF-048: 4-point perspective correction. Real projective geometry (not a fake blur/skew
 * stand-in) — a 3x3 homography computed from 4 point correspondences via the classic
 * "unit square -> quad" construction (Heckbert, "Fundamentals of Texture Mapping and
 * Image Warping", 1989), composed both ways to get an arbitrary quad-to-quad mapping.
 */

export interface Point {
  x: number;
  y: number;
}

/** Row-major 3x3 matrix, 9 elements. */
export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]; // eslint-disable-line prettier/prettier

export function multiplyMat3(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += a[row * 3 + k] * b[k * 3 + col];
      }
      r[row * 3 + col] = sum;
    }
  }
  return r as unknown as Mat3;
}

export function invertMat3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) {
    // Degenerate (collinear points) — fall back to identity rather than dividing by ~0.
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  const invDet = 1 / det;
  return [
    A * invDet,
    D * invDet,
    G * invDet,
    B * invDet,
    E * invDet,
    H * invDet,
    C * invDet,
    F * invDet,
    I * invDet,
  ] as unknown as Mat3; // eslint-disable-line prettier/prettier
}

/** Applies a homography to a point, including the perspective (homogeneous) divide. */
export function applyMat3(m: Mat3, p: Point): Point {
  const x = m[0] * p.x + m[1] * p.y + m[2];
  const y = m[3] * p.x + m[4] * p.y + m[5];
  const w = m[6] * p.x + m[7] * p.y + m[8];
  if (Math.abs(w) < 1e-12) return { x: 0, y: 0 };
  return { x: x / w, y: y / w };
}

/**
 * Maps the unit square (0,0)-(1,0)-(1,1)-(0,1) onto the given quad (same corner order).
 * Standard closed-form solution: the affine part comes directly from 3 of the 4 points;
 * the projective part (g, h) is solved from the 4th point via a 2x2 linear system.
 */
export function squareToQuad(quad: readonly [Point, Point, Point, Point]): Mat3 {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  let g: number;
  let h: number;
  if (Math.abs(dx3) < 1e-12 && Math.abs(dy3) < 1e-12) {
    // Already a parallelogram — no projective distortion needed.
    g = 0;
    h = 0;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    g = det === 0 ? 0 : (dx3 * dy2 - dx2 * dy3) / det;
    h = det === 0 ? 0 : (dx1 * dy3 - dx3 * dy1) / det;
  }

  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  const f = p0.y;

  return [a, b, c, d, e, f, g, h, 1];
}

/** General quad-to-quad projective mapping: src corners -> dst corners. */
export function computeHomography(
  src: readonly [Point, Point, Point, Point],
  dst: readonly [Point, Point, Point, Point]
): Mat3 {
  const squareToSrc = squareToQuad(src);
  const squareToDst = squareToQuad(dst);
  const srcToSquare = invertMat3(squareToSrc);
  return multiplyMat3(squareToDst, srcToSquare);
}
