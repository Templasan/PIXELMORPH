import { lightCopyNamesOf } from '@app/screens/photo-editor/resolution';
import { parseQualitySetting } from '@app/screens/usePreviewQuality';

describe('lightCopyNamesOf', () => {
  const uri = 'file:///docs/media/p1/photo.jpg';

  it('keeps the names from before the quality tiers at 2048 px', () => {
    expect(lightCopyNamesOf(uri, 2048)).toEqual({
      copy: 'file:///docs/media/p1/photo.preview.jpg',
      meta: 'file:///docs/media/p1/photo.preview.json',
    });
  });

  it('gives every other edge its own names, so copies never mix', () => {
    expect(lightCopyNamesOf(uri, 1600)).toEqual({
      copy: 'file:///docs/media/p1/photo.preview1600.jpg',
      meta: 'file:///docs/media/p1/photo.preview1600.json',
    });
    expect(lightCopyNamesOf(uri, 1080).copy).toBe('file:///docs/media/p1/photo.preview1080.jpg');
  });

  it('refuses an edge that is not a whole positive number', () => {
    expect(() => lightCopyNamesOf(uri, 0)).toThrow(RangeError);
    expect(() => lightCopyNamesOf(uri, 1.5)).toThrow(RangeError);
    expect(() => lightCopyNamesOf(uri, Number.NaN)).toThrow(RangeError);
  });
});

describe('parseQualitySetting', () => {
  it('reads the four saved values', () => {
    expect(parseQualitySetting('auto')).toBe('auto');
    expect(parseQualitySetting('alta')).toBe('alta');
    expect(parseQualitySetting('media')).toBe('media');
    expect(parseQualitySetting('baixa')).toBe('baixa');
  });

  it('treats a missing or unknown value as Automática', () => {
    expect(parseQualitySetting(null)).toBe('auto');
    expect(parseQualitySetting(undefined)).toBe('auto');
    expect(parseQualitySetting('ultra')).toBe('auto');
  });
});
