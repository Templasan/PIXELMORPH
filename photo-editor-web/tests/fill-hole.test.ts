import { fillHole } from '../src/domain/fillHole';

function picture(w: number, h: number, at: (x: number, y: number) => number) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const v = at(x, y);
      rgba.set([v, v, v, 255], (y * w + x) * 4);
    }
  return rgba;
}
function square(w: number, h: number, x0: number, y0: number, side: number) {
  const hole = new Uint8Array(w * h);
  for (let y = y0; y < y0 + side; y += 1) for (let x = x0; x < x0 + side; x += 1) hole[y * w + x] = 1;
  return hole;
}

describe('fillHole', () => {
  const w = 60;
  const h = 60;

  it('fills everything, and touches nothing outside the hole', () => {
    const rgba = picture(w, h, (x) => (x * 4) % 255);
    const before = rgba.slice();
    const hole = square(w, h, 20, 20, 12);
    expect(fillHole(rgba, w, h, hole)).toBe(0);
    for (let i = 0; i < hole.length; i += 1) {
      if (!hole[i]) expect(rgba[i * 4]).toBe(before[i * 4]);
    }
  });

  it('continues a plain background instead of what was on it', () => {
    const rgba = picture(w, h, (x, y) => (x >= 25 && x < 35 && y >= 25 && y < 35 ? 250 : 40));
    fillHole(rgba, w, h, square(w, h, 23, 23, 14));
    for (let y = 25; y < 35; y += 1) for (let x = 25; x < 35; x += 1) expect(rgba[(y * w + x) * 4]).toBe(40);
  });

  it('follows a stripe pattern across the hole', () => {
    const stripes = (x: number) => (x % 12 < 6 ? 30 : 220);
    const rgba = picture(w, h, stripes);
    fillHole(rgba, w, h, square(w, h, 24, 24, 10));
    let right = 0;
    for (let y = 24; y < 34; y += 1) for (let x = 24; x < 34; x += 1) if (rgba[(y * w + x) * 4] === stripes(x)) right += 1;
    expect(right).toBeGreaterThan(70);
  });

  it('is repeatable, and copes with a picture that is all hole', () => {
    const make = () => picture(w, h, (x, y) => (x * y) % 255);
    const a = make();
    const b = make();
    fillHole(a, w, h, square(w, h, 10, 10, 8));
    fillHole(b, w, h, square(w, h, 10, 10, 8));
    expect(a).toEqual(b);
    expect(fillHole(picture(4, 4, () => 9), 4, 4, new Uint8Array(16).fill(1))).toBe(16);
  });
});
