import { uprightDimensions } from '../../src/modules/device-media/uprightDimensions';

describe('uprightDimensions', () => {
  it('swaps for 90 and 270 (also negative / over 360)', () => {
    expect(uprightDimensions(1920, 1080, 90)).toEqual({ width: 1080, height: 1920 });
    expect(uprightDimensions(1920, 1080, 270)).toEqual({ width: 1080, height: 1920 });
    expect(uprightDimensions(1920, 1080, -90)).toEqual({ width: 1080, height: 1920 });
    expect(uprightDimensions(1920, 1080, 450)).toEqual({ width: 1080, height: 1920 });
  });
  it('keeps for 0, 180, null', () => {
    expect(uprightDimensions(1920, 1080, 0)).toEqual({ width: 1920, height: 1080 });
    expect(uprightDimensions(1920, 1080, 180)).toEqual({ width: 1920, height: 1080 });
    expect(uprightDimensions(1920, 1080, null)).toEqual({ width: 1920, height: 1080 });
  });
});
