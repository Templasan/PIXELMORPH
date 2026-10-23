import {
  bytesToBase64,
  crc32,
  readJpegDpi,
  readPngPhys,
  setJpegDpi,
  setPngDpi,
} from '@modules/export/exportBytes';

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** JFIF JPEG header (SOI, APP0 at 72 dpi, EOI). Only the header matters for these tests. */
const JFIF_JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]);

/** JPEG with no APP0 at all (SOI, DQT stub, EOI). */
const BARE_JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  view(out).setUint32(0, data.length);
  out.set(ascii(type), 4);
  out.set(data, 8);
  view(out).setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const ihdrData = new Uint8Array(13);
view(ihdrData).setUint32(0, 2);
view(ihdrData).setUint32(4, 3);
ihdrData.set([8, 2, 0, 0, 0], 8);

const PNG = concat([
  Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngChunk('IHDR', ihdrData),
  pngChunk('IDAT', Uint8Array.from([1, 2, 3, 4])),
  pngChunk('IEND', new Uint8Array(0)),
]);

describe('crc32', () => {
  it('matches the standard check value and the IEND chunk CRC', () => {
    expect(crc32(ascii('123456789'))).toBe(0xcbf43926);
    expect(crc32(ascii('IEND'))).toBe(0xae426082);
  });
});

describe('bytesToBase64', () => {
  it('matches Node base64 for every padding case', () => {
    for (const s of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar']) {
      expect(bytesToBase64(ascii(s))).toBe(Buffer.from(s).toString('base64'));
    }
  });
});

describe('setJpegDpi', () => {
  it('rewrites the JFIF density and units in an existing APP0 header', () => {
    const out = setJpegDpi(JFIF_JPEG, 300);
    expect(readJpegDpi(out)).toEqual({ units: 1, x: 300, y: 300 });
    expect(out.length).toBe(JFIF_JPEG.length);
    expect(readJpegDpi(JFIF_JPEG)).toEqual({ units: 0, x: 72, y: 72 }); // input not mutated
  });

  it('inserts a JFIF APP0 right after SOI when there is none', () => {
    const out = setJpegDpi(BARE_JPEG, 150);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(readJpegDpi(out)).toEqual({ units: 1, x: 150, y: 150 });
    expect(out.subarray(20)).toEqual(BARE_JPEG.subarray(2));
  });

  it('clamps the density to the 16-bit JFIF range', () => {
    expect(readJpegDpi(setJpegDpi(JFIF_JPEG, 0))?.x).toBe(1);
    expect(readJpegDpi(setJpegDpi(JFIF_JPEG, 1e9))?.x).toBe(65535);
  });

  it('rejects data that is not a JPEG', () => {
    expect(() => setJpegDpi(ascii('nope'), 300)).toThrow();
  });
});

describe('setPngDpi', () => {
  it('inserts a pHYs chunk after IHDR with pixels per metre and a valid CRC', () => {
    const out = setPngDpi(PNG, 300);
    expect(readPngPhys(out)).toEqual({ x: 11811, y: 11811, unit: 1 });
    // pHYs follows the signature (8) and the IHDR chunk (25 bytes).
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe('pHYs');
    expect(view(out).getUint32(33)).toBe(9);
    expect(view(out).getUint32(50)).toBe(crc32(out.subarray(37, 50)));
  });

  it('replaces an existing pHYs chunk instead of adding a second one', () => {
    const once = setPngDpi(PNG, 72);
    const twice = setPngDpi(once, 300);
    expect(twice.length).toBe(once.length);
    expect(readPngPhys(twice)).toEqual({ x: 11811, y: 11811, unit: 1 });
  });

  it('keeps the image chunks intact', () => {
    const out = setPngDpi(PNG, 300);
    expect(String.fromCharCode(...out.subarray(out.length - 8, out.length - 4))).toBe('IEND');
    expect(out.length).toBe(PNG.length + 21);
  });

  it('rejects data that is not a PNG', () => {
    expect(() => setPngDpi(ascii('not a png at all'), 300)).toThrow();
  });
});
