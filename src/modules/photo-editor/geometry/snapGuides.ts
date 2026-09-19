/**
 * RF-067: magnetic alignment guides — snaps a normalized (0..1) drag position to the
 * canvas's own center lines when it comes within `threshold`. Pure math so it's testable;
 * the Skia-touching guide-line rendering lives in LightPositionHandle.
 */

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
}

export function snapToGuides(nx: number, ny: number, threshold = 0.02): SnapResult {
  const snappedX = Math.abs(nx - 0.5) < threshold;
  const snappedY = Math.abs(ny - 0.5) < threshold;
  return {
    x: snappedX ? 0.5 : nx,
    y: snappedY ? 0.5 : ny,
    snappedX,
    snappedY,
  };
}
