import { cropsInHighlight, extremeAspectOf } from '../../src/app/screens/projects/thumbAspect';

describe('extremeAspectOf', () => {
  it('leaves ordinary shapes alone', () => {
    expect(extremeAspectOf(1600, 1200)).toBeNull();
    expect(extremeAspectOf(1080, 2400)).toBeNull();
    expect(extremeAspectOf(3, 1)).toBeNull();
  });

  it('keeps a long picture long, but never thinner than can be seen', () => {
    expect(extremeAspectOf(1000, 100)).toBe(10);
    expect(extremeAspectOf(1500, 3)).toBe(24);
    expect(extremeAspectOf(3, 1500)).toBe(1 / 24);
  });

  it('treats an unknown size as ordinary', () => {
    expect(extremeAspectOf(undefined, 100)).toBeNull();
    expect(extremeAspectOf(100, 0)).toBeNull();
  });
});

describe('cropsInHighlight', () => {
  it('is true for portrait and panoramic pictures only', () => {
    expect(cropsInHighlight(1080, 2400)).toBe(true);
    expect(cropsInHighlight(1500, 3)).toBe(true);
    expect(cropsInHighlight(1600, 1200)).toBe(false);
    expect(cropsInHighlight(undefined, undefined)).toBe(false);
  });
});
