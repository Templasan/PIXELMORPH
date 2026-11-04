import { convergenceCrop, vanishingPoint } from '../src/domain/suggestions';

const W = 200;
const H = 150;

/** A grey picture from `dark(x, y)`, softened as a resized photo is. */
function picture(dark: (x: number, y: number) => boolean | number) {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const v = 200 - 180 * Number(dark(x, y));
      rgba.set([v, v, v, 255], (y * W + x) * 4);
    }
  }
  return rgba;
}

/** Rays from a point, as a corridor or a road shows them. */
function rays(cx: number, cy: number, count: number) {
  return picture((x, y) => {
    const a = Math.atan2(y - cy, x - cx);
    return 0.5 + 0.5 * Math.sin(a * count);
  });
}

describe('vanishingPoint', () => {
  it('finds where the lines of a picture meet', () => {
    for (const [cx, cy] of [[140, 60], [60, 100], [100, 40]]) {
      const found = vanishingPoint(rays(cx, cy, 16), W, H);
      expect(found).not.toBeNull();
      expect(Math.abs(found!.x - cx / W)).toBeLessThan(0.05);
      expect(Math.abs(found!.y - cy / H)).toBeLessThan(0.05);
    }
  });

  it('finds nothing in a flat picture, a grid or parallel lines', () => {
    expect(vanishingPoint(picture(() => false), W, H)).toBeNull();
    expect(vanishingPoint(picture((x, y) => x % 20 < 3 || y % 20 < 3), W, H)).toBeNull();
    expect(vanishingPoint(picture((x, y) => (x + y) % 24 < 6), W, H)).toBeNull();
  });

  it('finds nothing in noise', () => {
    let seed = 7;
    const noise = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    expect(vanishingPoint(picture(() => noise() < 0.5), W, H)).toBeNull();
  });
});

describe('convergenceCrop', () => {
  it('puts the point on a third, inside the picture', () => {
    const crop = convergenceCrop({ x: 0.5, y: 0.5 }, 4 / 3)!;
    expect(crop.rule).toBe('Linhas de convergência');
    const tx = (0.5 - crop.x) / crop.w;
    const ty = (0.5 - crop.y) / crop.h;
    expect(Math.min(Math.abs(tx - 1 / 3), Math.abs(tx - 2 / 3))).toBeLessThan(0.05);
    expect(Math.min(Math.abs(ty - 1 / 3), Math.abs(ty - 2 / 3))).toBeLessThan(0.05);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y + crop.h).toBeLessThanOrEqual(1.0001);
  });

  it('suggests nothing it cannot honour, with the point in a corner', () => {
    expect(convergenceCrop({ x: 0.005, y: 0.005 }, 1)).toBeNull();
  });
});
