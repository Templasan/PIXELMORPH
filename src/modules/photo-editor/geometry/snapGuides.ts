/**
 * RF-067: magnetic alignment guides — snaps a normalized (0..1) drag position to the
 * canvas's own center lines (and optionally to extra targets such as other layers' centers
 * and edges) when it comes within `threshold`. Pure math so it's testable; the Skia/SVG
 * guide-line rendering lives in LightPositionHandle.
 */

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  /** The normalized coordinate of the guide line the position snapped to (null if none). */
  guideX: number | null;
  guideY: number | null;
}

export interface SnapTargets {
  x: number[];
  y: number[];
}

function nearest(v: number, targets: number[], threshold: number): number | null {
  let best: number | null = null;
  let bestDist = threshold;
  for (const t of targets) {
    const d = Math.abs(v - t);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

export function snapToGuides(
  nx: number,
  ny: number,
  threshold = 0.02,
  extra: SnapTargets = { x: [], y: [] }
): SnapResult {
  const guideX = nearest(nx, [0.5, ...extra.x], threshold);
  const guideY = nearest(ny, [0.5, ...extra.y], threshold);
  return {
    x: guideX ?? nx,
    y: guideY ?? ny,
    snappedX: guideX !== null,
    snappedY: guideY !== null,
    guideX,
    guideY,
  };
}
