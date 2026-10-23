import {
  GifPalette,
  GifWriter,
  gifDelayCs,
  lzwEncode,
} from '../../src/modules/video-editor/domain/gifEncoder';

/** Standard GIF LZW decoder (min code size 8), reading the 255-byte sub-blocks. */
function lzwDecode(blocks: Uint8Array): number[] {
  const data: number[] = [];
  let at = 0;
  while (blocks[at] !== 0) {
    const n = blocks[at];
    for (let i = 1; i <= n; i += 1) data.push(blocks[at + i]);
    at += n + 1;
  }
  const clear = 256;
  const eoi = 257;
  let dict: number[][] = [];
  const reset = () => {
    dict = [];
    for (let i = 0; i < 256; i += 1) dict.push([i]);
    dict.push([], []);
  };
  reset();
  let codeSize = 9;
  let bitPos = 0;
  const read = () => {
    let code = 0;
    for (let i = 0; i < codeSize; i += 1, bitPos += 1) {
      code |= ((data[bitPos >> 3] >> (bitPos & 7)) & 1) << i;
    }
    return code;
  };
  const out: number[] = [];
  let prev: number[] | null = null;
  for (;;) {
    const code = read();
    if (code === clear) {
      reset();
      codeSize = 9;
      prev = null;
      continue;
    }
    if (code === eoi) break;
    let entry: number[];
    if (prev === null) {
      entry = dict[code];
    } else {
      entry = code < dict.length ? dict[code] : [...prev, prev[0]];
      dict.push([...prev, entry[0]]);
      if (dict.length === 1 << codeSize && codeSize < 12) codeSize += 1;
    }
    out.push(...entry);
    prev = entry;
  }
  return out;
}

describe('GIF encoder', () => {
  it('LZW round-trips short, repetitive and long (dictionary reset) inputs', () => {
    const cases = [
      new Uint8Array([7]),
      new Uint8Array(1000).fill(3),
      Uint8Array.from({ length: 50_000 }, (_, i) => (i * 7919 + (i >> 5)) & 0xff),
    ];
    for (const input of cases) {
      expect(lzwDecode(lzwEncode(input))).toEqual([...input]);
    }
  });

  it('builds a palette with the exact colours when there are fewer than maxColors', () => {
    const palette = new GifPalette();
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255]);
    palette.addSample(rgba);
    palette.build(256);
    expect(palette.colors.length / 3).toBe(2);
    const red = palette.indexOf(255, 0, 0);
    const blue = palette.indexOf(0, 0, 255);
    expect(red).not.toBe(blue);
    expect([...palette.colors.subarray(red * 3, red * 3 + 3)]).toEqual([252, 4, 4]);
  });

  it('never returns more colours than asked', () => {
    const palette = new GifPalette();
    palette.addSample(Uint8Array.from({ length: 4 * 5000 }, (_, i) => (i * 37) & 0xff));
    palette.build(32);
    expect(palette.colors.length / 3).toBeLessThanOrEqual(32);
    expect(palette.indexOf(10, 200, 30)).toBeLessThan(32);
  });

  it('writes a GIF89a whose frames decode back to the palette indices', () => {
    const palette = new GifPalette();
    const frame = new Uint8Array(4 * 4 * 3);
    for (let p = 0; p < 12; p += 1) frame.set(p % 2 ? [0, 255, 0, 255] : [0, 0, 0, 255], p * 4);
    palette.addSample(frame);
    palette.build(256);
    const writer = new GifWriter(4, 3, palette);
    writer.addFrame(frame, 7);
    writer.addFrame(frame, 6);
    const gif = writer.finish();

    expect(String.fromCharCode(...gif.subarray(0, 6))).toBe('GIF89a');
    expect(gif[6] | (gif[7] << 8)).toBe(4);
    expect(gif[gif.length - 1]).toBe(0x3b);
    expect(writer.frameCount).toBe(2);
    // First image: after header (13) + colour table (768) + NETSCAPE block (19) + GCE (8).
    const descriptor = 13 + 768 + 19 + 8;
    expect(gif[descriptor]).toBe(0x2c);
    expect(gif[descriptor - 4] | (gif[descriptor - 3] << 8)).toBe(7);
    const pixels = lzwDecode(gif.subarray(descriptor + 11));
    const green = palette.indexOf(0, 255, 0);
    const black = palette.indexOf(0, 0, 0);
    expect(pixels).toEqual(Array.from({ length: 12 }, (_, p) => (p % 2 ? green : black)));
  });

  it('frame delays add up to the exact duration', () => {
    const total = Array.from({ length: 15 }, (_, f) => gifDelayCs(f, 15)).reduce((a, b) => a + b);
    expect(total).toBe(100);
  });
});
