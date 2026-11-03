import { warpField, warpRows, type WarpSample } from '../src/domain/layers';

const sample = (extra: Partial<WarpSample> = {}): WarpSample => ({
  x: 50, y: 50, dx: 10, dy: 0, radius: 20, strength: 1, mode: 'push', ...extra,
});
const at = (field: Float32Array, col: number, row: number, cols: number) => {
  const i = (row * (cols + 1) + col) * 2;
  return [field[i], field[i + 1]];
};

describe('warpField', () => {
  it('push reads from behind the finger at its centre, and nothing moves past its radius', () => {
    const f = warpField([sample()], 10, 10, 100, 100);
    expect(at(f, 5, 5, 10)[0]).toBeCloseTo(-10);
    expect(at(f, 0, 0, 10)).toEqual([0, 0]);
  });

  it('pull reads from farther out, and its centre stays put', () => {
    const f = warpField([sample({ mode: 'pull' })], 10, 10, 100, 100);
    expect(at(f, 5, 5, 10)).toEqual([0, 0]);
    expect(at(f, 6, 5, 10)[0]).toBeGreaterThan(0);
  });

  it('twirl turns points around the centre', () => {
    const f = warpField([sample({ mode: 'twirl' })], 10, 10, 100, 100);
    expect(at(f, 6, 5, 10)[1]).toBeGreaterThan(0);
  });

  it('strength scales the effect and samples add up', () => {
    const half = warpField([sample({ strength: 0.5 })], 10, 10, 100, 100);
    expect(at(half, 5, 5, 10)[0]).toBeCloseTo(-5);
    const twice = warpField([sample(), sample()], 10, 10, 100, 100);
    expect(at(twice, 5, 5, 10)[0]).toBeCloseTo(-20);
  });

  it('the grid keeps roughly square quads', () => {
    expect(warpRows(340, 680)).toBe(96);
    expect(warpRows(340, 3)).toBe(2);
  });
});
