import {
  cellPixelRect,
  CENTRED_PAN,
  COLLAGE_LAYOUTS,
  coverPlacement,
  gridLayout,
  panByDrag,
} from '../src/domain/collage/CollageMath';
import { coverFitRect } from '../src/domain/export/exportMath';

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

describe('coverPlacement (RF-011 pan)', () => {
  const square = { width: 100, height: 100 };
  const wide = { width: 200, height: 100 }; // covers a square cell with 100 px to spare on x
  const tall = { width: 100, height: 200 }; // 100 px to spare on y

  it('centred pan equals the cover-fit result the collage drew before pans existed', () => {
    for (const pic of [wide, tall, { width: 300, height: 170 }, { width: 80, height: 80 }]) {
      const cell = { width: 150, height: 90 };
      const old = coverFitRect(pic.width, pic.height, cell.width, cell.height);
      expect(coverPlacement(pic, cell, CENTRED_PAN)).toEqual(old);
    }
  });

  it('a wide photo slides between its left and right edges', () => {
    expect(coverPlacement(wide, square, { x: 1, y: 0 }).x).toBe(0);
    expect(coverPlacement(wide, square, { x: -1, y: 0 }).x).toBe(-100);
    expect(coverPlacement(wide, square, CENTRED_PAN).x).toBe(-50);
  });

  it('a tall photo slides between its top and bottom edges', () => {
    expect(coverPlacement(tall, square, { x: 0, y: 1 }).y).toBe(0);
    expect(coverPlacement(tall, square, { x: 0, y: -1 }).y).toBe(-100);
  });

  it('a photo that fits its axis exactly does not move on that axis', () => {
    expect(coverPlacement(wide, square, { x: 0, y: 1 }).y).toBeCloseTo(0, 9);
    expect(coverPlacement(wide, square, { x: 0, y: -1 }).y).toBeCloseTo(0, 9);
  });

  it('never leaves an empty area: out-of-range pans are clamped to the cell edge', () => {
    for (const pan of [{ x: 9, y: -9 }, { x: -3, y: 3 }]) {
      const p = coverPlacement(wide, square, pan);
      expect(p.x).toBeLessThanOrEqual(0);
      expect(p.x + p.width).toBeGreaterThanOrEqual(square.width);
      expect(p.y).toBeLessThanOrEqual(0);
      expect(p.y + p.height).toBeGreaterThanOrEqual(square.height);
    }
  });
});

describe('panByDrag (RF-011 pan)', () => {
  const square = { width: 100, height: 100 };
  const wide = { width: 200, height: 100 };

  it('dragging moves the photo with the pointer', () => {
    // 100 px of spare on x maps to pan 2 per 100 px dragged: 25 px is 0.5 of the way to the edge.
    const pan = panByDrag(wide, square, CENTRED_PAN, 25, 0);
    expect(pan.x).toBeCloseTo(0.5, 9);
    const placed = coverPlacement(wide, square, pan).x;
    expect(placed).toBeCloseTo(-50 + 25, 9);
  });

  it('stops at the cell edge however far it is dragged', () => {
    expect(panByDrag(wide, square, CENTRED_PAN, 1000, 0).x).toBe(1);
    expect(panByDrag(wide, square, CENTRED_PAN, -1000, 0).x).toBe(-1);
  });

  it('keeps the pan on an axis with no spare room', () => {
    expect(panByDrag(wide, square, { x: 0.2, y: 0.7 }, 0, 50).y).toBe(0.7);
  });
});

describe('gridLayout (RF-011 Personalizado)', () => {
  it('makes rows x columns equal cells that tile the canvas', () => {
    const layout = gridLayout(2, 3);
    expect(layout.cells).toHaveLength(6);
    for (const c of layout.cells) {
      expect(c.width).toBeCloseTo(1 / 3, 9);
      expect(c.height).toBeCloseTo(1 / 2, 9);
    }
    const area = layout.cells.reduce((sum, c) => sum + c.width * c.height, 0);
    expect(area).toBeCloseTo(1, 9);
  });

  it('1 x 1 is one full cell', () => {
    expect(gridLayout(1, 1).cells).toEqual([{ x: 0, y: 0, width: 1, height: 1 }]);
  });

  it('clamps the counts to 1..4', () => {
    expect(gridLayout(0, 9).cells).toHaveLength(4);
    expect(gridLayout(9, 0).cells).toHaveLength(4);
  });
});
