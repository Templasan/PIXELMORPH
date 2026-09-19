import { cellPixelRect, COLLAGE_LAYOUTS } from '@modules/photo-editor/collage/CollageMath';

describe('COLLAGE_LAYOUTS', () => {
  it('each layout tiles the full 0..1 canvas with no gaps (cell areas sum to 1)', () => {
    for (const layout of COLLAGE_LAYOUTS) {
      const area = layout.cells.reduce((sum, c) => sum + c.width * c.height, 0);
      expect(area).toBeCloseTo(1, 5);
    }
  });
});

describe('cellPixelRect', () => {
  it('maps a full-canvas cell to the full canvas when spacing is 0', () => {
    const rect = cellPixelRect({ x: 0, y: 0, width: 1, height: 1 }, 400, 200, 0);
    expect(rect).toEqual({ x: 0, y: 0, width: 400, height: 200 });
  });

  it('insets each edge by half the spacing', () => {
    const rect = cellPixelRect({ x: 0, y: 0, width: 0.5, height: 1 }, 400, 200, 20);
    expect(rect.x).toBe(10);
    expect(rect.width).toBe(400 * 0.5 - 20);
    expect(rect.height).toBe(200 - 20);
  });
});
