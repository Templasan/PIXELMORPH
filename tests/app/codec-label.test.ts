import { codecLabel } from '../../src/app/screens/projects/projectFormat';

describe('codecLabel', () => {
  it('names the usual codecs and keeps unknown ones', () => {
    expect(codecLabel(['video/avc', 'audio/mp4a-latm'])).toBe('H.264 + AAC');
    expect(codecLabel(['video/hevc'])).toBe('H.265 (HEVC)');
    expect(codecLabel(['video/x-unknown'])).toBe('video/x-unknown');
    expect(codecLabel([])).toBe('');
  });
});
