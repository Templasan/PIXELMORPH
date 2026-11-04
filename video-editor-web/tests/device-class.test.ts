import { isLowEndDevice, previewShortEdge, speechMinutesOn } from '../src/domain/deviceClass';

describe('deviceClass', () => {
  it('treats 3 GB or less as low-end, and an unknown phone as normal', () => {
    expect(isLowEndDevice(2)).toBe(true);
    expect(isLowEndDevice(3)).toBe(true);
    expect(isLowEndDevice(4)).toBe(false);
    expect(isLowEndDevice(undefined)).toBe(false);
  });

  it('draws the preview smaller on a low-end phone', () => {
    expect(previewShortEdge(2)).toBe(540);
    expect(previewShortEdge(8)).toBe(720);
    expect(previewShortEdge(undefined)).toBe(720);
  });

  it('warns about speech time only on a low-end phone, rounded up', () => {
    expect(speechMinutesOn(2, 24500)).toBe(1);
    expect(speechMinutesOn(2, 120000)).toBe(3);
    expect(speechMinutesOn(2, 1000)).toBe(1);
    expect(speechMinutesOn(8, 24500)).toBeNull();
    expect(speechMinutesOn(undefined, 24500)).toBeNull();
  });
});
