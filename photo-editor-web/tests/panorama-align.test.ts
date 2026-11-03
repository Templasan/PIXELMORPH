import { alignPair, type GreyPicture } from '../src/domain/panorama/alignPair';
import { panoramaLayout } from '../src/domain/panorama/panoramaLayout';

/** A scene with detail everywhere, repeatable. */
const scene = (x: number, y: number) =>
  128 + 60 * Math.sin(x / 7) * Math.cos(y / 5) + 40 * Math.sin((x + y) / 13) + 20 * Math.sin((x * y) / 300);

function shot(left: number, top: number, width: number, height: number, gain = 1): GreyPicture {
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) data[y * width + x] = scene(left + x, top + y) * gain;
  return { width, height, data };
}

describe('alignPair', () => {
  it('finds the overlap and the vertical shift of two shots of one scene', () => {
    // The right shot starts 120 px on, so 40 of its 160 overlap; and its frame starts 12 px lower in the scene, so it sits 12 px lower in the result.
    const p = alignPair(shot(0, 20, 160, 120), shot(120, 32, 160, 120))!;
    expect(p.overlap).toBeCloseTo(40 / 160, 1);
    expect(p.offsetY).toBeCloseTo(12 / 120, 1);
    expect(p.score).toBeGreaterThan(0.9);
  });

  it('is not fooled by one shot being darker', () => {
    const p = alignPair(shot(0, 20, 160, 120), shot(100, 20, 160, 120, 0.7))!;
    expect(p.overlap).toBeCloseTo(60 / 160, 1);
    expect(p.offsetY).toBeCloseTo(0, 1);
  });

  it('gives no answer for photos with nothing to compare', () => {
    const flat = (v: number): GreyPicture => ({ width: 100, height: 60, data: new Uint8ClampedArray(6000).fill(v) });
    expect(alignPair(flat(40), flat(200))).toBeNull();
  });
});

describe('panoramaLayout with one overlap per photo', () => {
  it('uses each photo own share', () => {
    const size = { width: 100, height: 100 };
    const l = panoramaLayout([size, size, size], 100, [0, 0.1, 0.5]);
    expect(l.rects.map((r) => r.x)).toEqual([0, 90, 140]);
  });
});
