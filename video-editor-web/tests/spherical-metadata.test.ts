import { withSphericalMetadata } from '../src/domain/sphericalMetadata';

const text = (s: string) => [...s].map((c) => c.charCodeAt(0));
function box(type: string, ...parts: number[][]): number[] {
  const body = parts.flat();
  const size = body.length + 8;
  return [(size >>> 24) & 255, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, ...text(type), ...body];
}
const track = (handler: string) =>
  box('trak', box('tkhd', [1, 2, 3]), box('mdia', box('hdlr', [0, 0, 0, 0, 0, 0, 0, 0], text(handler), [9, 9])));
const u32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint32(at);
const decoded = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

describe('withSphericalMetadata', () => {
  const sound = track('soun');
  const picture = track('vide');
  const moov = Uint8Array.from(box('moov', box('mvhd', [7]), sound, picture));

  it('adds the box inside the video track and keeps every size right', () => {
    const out = withSphericalMetadata(moov);
    const added = out.length - moov.length;
    expect(added).toBeGreaterThan(100);
    expect(u32(out, 0)).toBe(out.length);
    const soundAt = 8 + 9;
    expect(u32(out, soundAt)).toBe(sound.length);
    const pictureAt = soundAt + sound.length;
    expect(u32(out, pictureAt)).toBe(picture.length + added);
    const uuidAt = pictureAt + picture.length;
    expect(decoded(out.subarray(uuidAt + 4, uuidAt + 8))).toBe('uuid');
    expect(u32(out, uuidAt)).toBe(added);
    expect(decoded(out)).toContain('<GSpherical:ProjectionType>equirectangular<');
  });

  it('leaves what was there untouched, and a file with no video alone', () => {
    const out = withSphericalMetadata(moov);
    expect([...out.subarray(8, 17)]).toEqual([...moov.subarray(8, 17)]);
    const onlySound = Uint8Array.from(box('moov', sound));
    expect(withSphericalMetadata(onlySound)).toBe(onlySound);
  });
});
