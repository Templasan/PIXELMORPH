import { panoramaLayout } from '../src/domain/panorama/panoramaLayout';

describe('panoramaLayout', () => {
  it('scales to one height and overlaps each photo by its share of its own width', () => {
    const l = panoramaLayout(
      [
        { width: 400, height: 300 },
        { width: 800, height: 600 },
        { width: 300, height: 300 },
      ],
      300,
      0.25,
      [0, 0.1]
    );
    expect(l.rects.map((r) => [r.x, r.width, r.fade])).toEqual([
      [0, 400, 0],
      [300, 400, 100],
      [625, 300, 75],
    ]);
    // Photo 2 sits 30 px lower: the picture keeps rows 30..300 of photo 1.
    expect(l.rects.map((r) => r.y)).toEqual([-30, 0, -30]);
    expect(l.height).toBe(270);
    expect(l.width).toBe(925);
  });

  it('without overlap the photos just sit side by side', () => {
    const l = panoramaLayout([{ width: 100, height: 100 }, { width: 100, height: 100 }], 100, 0);
    expect(l.width).toBe(200);
  });
});

describe('panoramaLayout nudged all up', () => {
  it('keeps the full height when every photo moves the same way', () => {
    const l = panoramaLayout([{ width: 100, height: 100 }, { width: 100, height: 100 }], 100, 0, [-0.1, -0.1]);
    expect(l.height).toBe(100);
    expect(l.rects.map((r) => r.y)).toEqual([0, 0]);
  });
});
