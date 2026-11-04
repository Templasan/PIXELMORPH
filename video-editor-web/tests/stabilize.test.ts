import {
  correctionAt,
  correctionsOf,
  fitCorrection,
  FOCAL_OVER_LONG_SIDE,
  STABLE_ZOOM,
  type MotionSample,
} from '../src/domain/stabilize';

const STEP = 20;
/** Upright, gravity along +y, turning at the rates given. */
function recording(seconds: number, gyro: (t: number) => [number, number, number], accel: [number, number, number] = [0, 1, 0]): MotionSample[] {
  const out: MotionSample[] = [];
  for (let ms = 0; ms <= seconds * 1000; ms += STEP) out.push([ms, ...gyro(ms / 1000), ...accel]);
  return out;
}
const peak = (values: number[]) => Math.max(...values.map(Math.abs));
const middle = <T,>(list: T[]) => list.slice(Math.floor(list.length * 0.2), Math.floor(list.length * 0.8));
const shake = (t: number, size: number) => size * 2 * Math.PI * 3 * Math.cos(2 * Math.PI * 3 * t);

describe('correctionsOf', () => {
  it('needs something to go on', () => {
    expect(correctionsOf([])).toEqual([]);
  });

  it('corrects shake by its size, in the opposite direction to how the scene moved', () => {
    const size = 0.01;
    const path = middle(correctionsOf(recording(6, (t) => [0, shake(t, size), 0])));
    expect(peak(path.map((c) => c.dx))).toBeCloseTo(FOCAL_OVER_LONG_SIDE * size, 2);
    expect(peak(path.map((c) => c.dy))).toBeLessThan(1e-9);
    // Turning left at the start moves the scene right, so the correction goes left.
    const first = correctionsOf(recording(2, (t) => [0, t < 0.05 ? 0.2 : 0, 0]));
    expect(first.find((c) => c.ms >= 60)!.dx).toBeLessThan(0);
  });

  it('corrects a tilt up by moving the picture up, and a phone turned left by turning right', () => {
    const tilt = correctionsOf(recording(2, (t) => [t < 0.05 ? 0.2 : 0, 0, 0]));
    expect(tilt.find((c) => c.ms >= 60)!.dy).toBeLessThan(0);
    const turn = correctionsOf(recording(2, (t) => [0, 0, t < 0.05 ? 0.2 : 0], [0, 1, 0]));
    expect(turn.find((c) => c.ms >= 60)!.rot).toBeLessThan(0);
  });

  it('leaves a slow pan alone', () => {
    const path = middle(correctionsOf(recording(10, () => [0, 0.1, 0])));
    expect(peak(path.map((c) => c.dx))).toBeLessThan(1e-6);
  });

  it('uses gravity so a still phone does not drift in roll', () => {
    // A gyro that wrongly reports a constant turn: gravity holds the angle, so nothing grows.
    const path = correctionsOf(recording(20, () => [0, 0, 0.02]));
    expect(peak(middle(path).map((c) => c.rot))).toBeLessThan(0.01);
  });

  it('follows the picture when the phone is held sideways', () => {
    // Top of the phone to the left: x points up, so turning about x turns the view left.
    const sideways = correctionsOf(recording(2, (t) => [t < 0.05 ? 0.2 : 0, 0, 0], [1, 0, 0]));
    const c = sideways.find((p) => p.ms >= 60)!;
    expect(c.dx).toBeLessThan(0);
    expect(Math.abs(c.dy)).toBeLessThan(1e-9);
  });
});

describe('correctionAt', () => {
  const path = [
    { ms: 0, dx: 0, dy: 0, rot: 0 },
    { ms: 100, dx: 1, dy: 2, rot: 3 },
  ];
  it('goes between steps and holds at the ends', () => {
    expect(correctionAt(path, 50)!.dx).toBeCloseTo(0.5);
    expect(correctionAt(path, -5)!.dx).toBe(0);
    expect(correctionAt(path, 500)!.rot).toBe(3);
    expect(correctionAt([], 5)).toBeNull();
  });
});

describe('fitCorrection', () => {
  it('turns it into pixels of the long side', () => {
    expect(fitCorrection({ ms: 0, dx: 0.01, dy: 0.01, rot: 0 }, 1000, 500).dx).toBeCloseTo(10 * STABLE_ZOOM);
    expect(fitCorrection({ ms: 0, dx: 0.01, dy: 0.01, rot: 0 }, 1000, 500).dy).toBeCloseTo(10 * STABLE_ZOOM);
  });
  it('never shows an edge, however hard the shake', () => {
    const w = 1000;
    const h = 500;
    const f = fitCorrection({ ms: 0, dx: 1, dy: -1, rot: 1 }, w, h);
    expect(f.dx).toBeLessThan(((STABLE_ZOOM - 1) / 2) * w);
    expect(Math.abs(f.dy)).toBeLessThan(((STABLE_ZOOM - 1) / 2) * h);
    expect(f.rot).toBeLessThan(0.03);
  });
});
