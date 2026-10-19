import {
  EXPORT_MAX_LONG_EDGE,
  exportScaleOf,
  fitLongEdgeOf,
} from '@app/screens/photo-editor/resolution';

const FRAME_W = 340;
const FRAME_H = 227;

describe('fitLongEdgeOf', () => {
  it('leaves an image at or under the cap unchanged', () => {
    expect(fitLongEdgeOf(1000, 750, 2048)).toEqual({ width: 1000, height: 750 });
    expect(fitLongEdgeOf(2048, 1536, 2048)).toEqual({ width: 2048, height: 1536 });
  });

  it('downscales a landscape image keeping its aspect', () => {
    expect(fitLongEdgeOf(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
  });

  it('downscales a portrait image keeping its aspect', () => {
    expect(fitLongEdgeOf(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
  });
});

describe('exportScaleOf', () => {
  it('draws a 4000x3000 photo at its native size inside the 340x227 frame', () => {
    const scale = exportScaleOf(4000, 3000, FRAME_W, FRAME_H);
    expect(scale).toBeCloseTo(4000 / FRAME_W, 6);
    // Output is the frame scaled up; the photo is cover-fitted, so the frame height is the
    // tighter axis here and the output keeps the frame's aspect.
    expect(Math.round(FRAME_W * scale)).toBe(4000);
    expect(Math.round(FRAME_H * scale)).toBe(2671);
  });

  it('caps the output long edge at EXPORT_MAX_LONG_EDGE', () => {
    const scale = exportScaleOf(20000, 15000, FRAME_W, FRAME_H);
    expect(scale).toBeCloseTo(EXPORT_MAX_LONG_EDGE / FRAME_W, 6);
    expect(Math.round(FRAME_W * scale)).toBe(EXPORT_MAX_LONG_EDGE);
  });

  it('never exports a photo smaller than the frame below frame size', () => {
    expect(exportScaleOf(200, 150, FRAME_W, FRAME_H)).toBe(1);
  });
});
