import { normaliseHex, sameHex } from '../../src/app/screens/photo-editor/colorHex';

describe('normaliseHex', () => {
  it('expands the 3-digit form and upper-cases', () => {
    expect(normaliseHex('#abc')).toBe('#AABBCC');
    expect(normaliseHex('abc')).toBe('#AABBCC');
  });

  it('accepts the 6-digit form in any case', () => {
    expect(normaliseHex('#AABBCC')).toBe('#AABBCC');
    expect(normaliseHex('#aabbcc')).toBe('#AABBCC');
    expect(normaliseHex('  #3a8fde ')).toBe('#3A8FDE');
  });

  it('rejects garbage', () => {
    for (const bad of ['', '#', '#abcd', '#abcde', '#gggggg', 'rgb(1,2,3)', '#12345678', 'red']) {
      expect(normaliseHex(bad)).toBeNull();
    }
  });
});

describe('sameHex', () => {
  it('compares across case and short form', () => {
    expect(sameHex('#fff', '#FFFFFF')).toBe(true);
    expect(sameHex('#3a8fde', '#3A8FDE')).toBe(true);
    expect(sameHex('#000', '#FFFFFF')).toBe(false);
    expect(sameHex('nope', 'nope')).toBe(false);
  });
});
