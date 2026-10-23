import {
  layoutWatermark,
  watermarkFontSize,
  WATERMARK_MARGIN_RATIO,
} from '@modules/export/exportMath';

const W = 1000;
const H = 800;
const TEXT_W = 200;
const FONT = watermarkFontSize(W, 40); // 100 px

describe('watermarkFontSize', () => {
  it('scales the slider as a fraction of the image width', () => {
    expect(watermarkFontSize(1000, 40)).toBe(100);
    expect(watermarkFontSize(2000, 40)).toBe(200);
  });
});

describe('layoutWatermark', () => {
  const margin = W * WATERMARK_MARGIN_RATIO;

  it('places the top-left cell at the margin', () => {
    const p = layoutWatermark(W, H, TEXT_W, FONT, 0);
    expect(p.x).toBeCloseTo(margin);
    expect(p.baselineY).toBeCloseTo(margin + FONT * 0.8);
  });

  it('places the bottom-right cell against the right and bottom margins', () => {
    const p = layoutWatermark(W, H, TEXT_W, FONT, 8);
    expect(p.x + TEXT_W).toBeCloseTo(W - margin);
    expect(p.pivotY + FONT / 2).toBeCloseTo(H - margin);
  });

  it('centres the middle cell', () => {
    const p = layoutWatermark(W, H, TEXT_W, FONT, 4);
    expect(p.x + TEXT_W / 2).toBeCloseTo(W / 2);
    expect(p.pivotY).toBeCloseTo(H / 2);
  });

  it('keeps the rotation pivot at the centre of the text box', () => {
    const p = layoutWatermark(W, H, TEXT_W, FONT, 6);
    expect(p.pivotX).toBeCloseTo(p.x + TEXT_W / 2);
    expect(p.pivotY).toBeCloseTo(H - margin - FONT / 2);
  });

  it('clamps out-of-range cells to the grid', () => {
    expect(layoutWatermark(W, H, TEXT_W, FONT, 99)).toEqual(layoutWatermark(W, H, TEXT_W, FONT, 8));
    expect(layoutWatermark(W, H, TEXT_W, FONT, -3)).toEqual(layoutWatermark(W, H, TEXT_W, FONT, 0));
  });
});
