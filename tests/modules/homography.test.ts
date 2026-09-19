import {
  applyMat3,
  computeHomography,
  invertMat3,
  multiplyMat3,
  squareToQuad,
} from '@modules/photo-editor/geometry/homography';

function expectPointClose(a: { x: number; y: number }, b: { x: number; y: number }, eps = 1e-6) {
  expect(Math.abs(a.x - b.x)).toBeLessThan(eps);
  expect(Math.abs(a.y - b.y)).toBeLessThan(eps);
}

describe('squareToQuad', () => {
  it('maps the unit square onto itself as the identity matrix', () => {
    const m = squareToQuad([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
    expect(m).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('maps each unit-square corner exactly onto the matching quad corner', () => {
    const quad = [
      { x: 10, y: 20 },
      { x: 100, y: 30 },
      { x: 90, y: 120 },
      { x: 5, y: 110 },
    ] as const;
    const m = squareToQuad(quad);
    expectPointClose(applyMat3(m, { x: 0, y: 0 }), quad[0]);
    expectPointClose(applyMat3(m, { x: 1, y: 0 }), quad[1]);
    expectPointClose(applyMat3(m, { x: 1, y: 1 }), quad[2]);
    expectPointClose(applyMat3(m, { x: 0, y: 1 }), quad[3]);
  });
});

describe('invertMat3', () => {
  it('composes with the original matrix to the identity', () => {
    const m = squareToQuad([
      { x: 10, y: 20 },
      { x: 100, y: 30 },
      { x: 90, y: 120 },
      { x: 5, y: 110 },
    ]);
    const inv = invertMat3(m);
    const product = multiplyMat3(m, inv);
    for (let i = 0; i < 9; i++) {
      expect(product[i]).toBeCloseTo(i % 4 === 0 ? 1 : 0, 5);
    }
  });
});

describe('computeHomography', () => {
  it('is the identity when source and destination quads match', () => {
    const quad = [
      { x: 0, y: 0 },
      { x: 340, y: 0 },
      { x: 340, y: 227 },
      { x: 0, y: 227 },
    ] as const;
    const h = computeHomography(quad, quad);
    expectPointClose(applyMat3(h, { x: 100, y: 50 }), { x: 100, y: 50 });
  });

  it('maps every source corner exactly to its destination corner', () => {
    const src = [
      { x: 20, y: 30 },
      { x: 300, y: 10 },
      { x: 320, y: 200 },
      { x: 10, y: 210 },
    ] as const;
    const dst = [
      { x: 0, y: 0 },
      { x: 340, y: 0 },
      { x: 340, y: 227 },
      { x: 0, y: 227 },
    ] as const;
    const h = computeHomography(src, dst);
    for (let i = 0; i < 4; i++) {
      expectPointClose(applyMat3(h, src[i]), dst[i], 1e-3);
    }
  });
});
