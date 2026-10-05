import { describeFileOrientation } from '../../src/modules/video-editor/orientation';

describe('describeFileOrientation (RF-078)', () => {
  it('says nothing when the file could not be read', () => {
    expect(describeFileOrientation(null)).toBe('');
  });

  it('reports an untouched file as normal', () => {
    expect(describeFileOrientation(0)).toMatch(/normal/);
  });

  it('reports the recorded turn as corrected automatically', () => {
    expect(describeFileOrientation(90)).toMatch(/90°.*automaticamente/);
    expect(describeFileOrientation(270)).toMatch(/270°/);
  });

  it('normalises odd values to a quarter turn', () => {
    expect(describeFileOrientation(-90)).toMatch(/270°/);
    expect(describeFileOrientation(450)).toMatch(/90°/);
  });
});
