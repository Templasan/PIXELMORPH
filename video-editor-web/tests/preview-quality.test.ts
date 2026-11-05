import {
  autoTier,
  LIVE_LAYER_CAP,
  PREVIEW_SHORT_EDGE,
  qualitySettingOf,
  tierOf,
} from '../src/domain/previewQuality';

describe('autoTier', () => {
  it('follows the phone memory, and guesses Média when unknown', () => {
    expect(autoTier(2)).toBe('baixa');
    expect(autoTier(3)).toBe('baixa');
    expect(autoTier(4)).toBe('media');
    expect(autoTier(6)).toBe('media');
    expect(autoTier(8)).toBe('alta');
    expect(autoTier(undefined)).toBe('media');
  });
});

describe('tierOf and qualitySettingOf', () => {
  it('a pick wins over the phone; Automática takes the phone', () => {
    expect(tierOf('alta', 2)).toBe('alta');
    expect(tierOf('baixa', 8)).toBe('baixa');
    expect(tierOf('auto', 8)).toBe('alta');
    expect(tierOf('auto', undefined)).toBe('media');
  });

  it('reads only the five fixed values; anything else is Automática', () => {
    expect(qualitySettingOf('alta')).toBe('alta');
    expect(qualitySettingOf('media')).toBe('media');
    expect(qualitySettingOf('baixa')).toBe('baixa');
    expect(qualitySettingOf('auto')).toBe('auto');
    expect(qualitySettingOf(undefined)).toBe('auto');
    expect(qualitySettingOf('ultra')).toBe('auto');
  });
});

describe('tier sizes', () => {
  it('Baixa is the old low-end path, Média the normal one, Alta the 1080p one', () => {
    expect(PREVIEW_SHORT_EDGE).toEqual({ alta: 1080, media: 720, baixa: 540 });
    expect(LIVE_LAYER_CAP).toEqual({ alta: 8, media: 4, baixa: 2 });
  });
});
