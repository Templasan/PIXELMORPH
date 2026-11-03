import { dominantColors, harmonies, saliencyMap, suggestCrops } from '../src/domain/suggestions';

function picture(w: number, h: number, at: (x: number, y: number) => [number, number, number]) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const [r, g, b] = at(x, y);
      rgba.set([r, g, b, 255], (y * w + x) * 4);
    }
  return rgba;
}

describe('dominantColors', () => {
  it('finds the colours, the most common first', () => {
    const rgba = picture(20, 20, (x) => (x < 15 ? [200, 0, 0] : [0, 0, 200]));
    expect(dominantColors(rgba, 2)).toEqual(['#C80000', '#0000C8']);
  });

  it('a one-colour picture gives one colour, and an empty one none', () => {
    expect(dominantColors(picture(4, 4, () => [10, 10, 10]))).toEqual(['#0A0A0A']);
    expect(dominantColors(new Uint8ClampedArray(16))).toEqual([]);
  });
});

describe('harmonies', () => {
  it('the complement of red is cyan and a triad turns by a third', () => {
    const [complementary, , triad] = harmonies('#FF0000');
    expect(complementary.colors).toEqual(['#FF0000', '#00FFFF']);
    expect(triad.colors).toEqual(['#FF0000', '#00FF00', '#0000FF']);
  });
});

describe('suggestCrops', () => {
  const w = 96;
  const h = 72;
  const subject = (cx: number, cy: number) =>
    picture(w, h, (x, y) => (Math.hypot(x - cx, y - cy) < 5 ? [255, 255, 255] : [20, 20, 20]));
  const of = (rgba: Uint8ClampedArray) => suggestCrops(saliencyMap(rgba, w, h), w, h, w / h);

  it('a flat picture has nothing to suggest', () => {
    expect(of(picture(w, h, () => [50, 50, 50]))).toEqual([]);
  });

  it('crops stay inside the picture and keep the subject', () => {
    const crops = of(subject(48, 36));
    expect(crops.length).toBeGreaterThan(0);
    for (const c of crops) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(1.0001);
      expect(c.y + c.h).toBeLessThanOrEqual(1.0001);
      expect(48 / w).toBeGreaterThanOrEqual(c.x);
      expect(48 / w).toBeLessThanOrEqual(c.x + c.w);
    }
  });

  it('the best crop moves a centred subject off the centre, toward a third', () => {
    const c = of(subject(48, 36))[0];
    const inCropX = (48 / w - c.x) / c.w;
    const inCropY = (36 / h - c.y) / c.h;
    const offCentre = Math.abs(inCropX - 0.5) + Math.abs(inCropY - 0.5);
    expect(offCentre).toBeGreaterThan(0.05);
  });
});
