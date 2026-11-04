import { encodeShapeFor } from '../src/domain/encodeShape';

const a11 = async (w: number, h: number) => w <= 1920 && h <= 1088;

describe('encodeShapeFor', () => {
  it('keeps a size the encoder takes as it is', async () => {
    expect(await encodeShapeFor(1920, 1080, a11)).toEqual({ width: 1920, height: 1080, rotation: 0 });
    expect(await encodeShapeFor(540, 960, a11)).toEqual({ width: 540, height: 960, rotation: 0 });
  });

  it('lays a tall picture down when only that fits', async () => {
    expect(await encodeShapeFor(1080, 1920, a11)).toEqual({ width: 1920, height: 1080, rotation: 90 });
    expect(await encodeShapeFor(720, 1280, a11)).toEqual({ width: 1280, height: 720, rotation: 90 });
  });

  it('says so when nothing fits', async () => {
    expect(await encodeShapeFor(4000, 3000, a11)).toBeNull();
    expect(await encodeShapeFor(3000, 4000, a11)).toBeNull();
  });
});
