import { encodePsd, opaqueBounds, type PsdLayer } from '../src/domain/export/psd';
import { adobeRgbProfile, proofCmyk, setJpegIcc, srgbToAdobeRgb } from '../src/domain/export/colorSpace';
import { setPngIcc } from '../src/domain/export/exportBytes';

const u16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

function unpack(b: Uint8Array, at: number, size: number): number[] {
  const out: number[] = [];
  let i = at;
  while (out.length < size) {
    const n = b[i] > 127 ? b[i] - 256 : b[i];
    i += 1;
    if (n >= 0) {
      for (let k = 0; k <= n; k += 1) out.push(b[i + k]);
      i += n + 1;
    } else {
      for (let k = 0; k <= -n; k += 1) out.push(b[i]);
      i += 1;
    }
  }
  return out;
}

describe('encodePsd', () => {
  const w = 3;
  const h = 2;
  const composite = new Uint8ClampedArray(w * h * 4).fill(200);
  const layer: PsdLayer = {
    name: 'Texto 1',
    left: 1,
    top: 0,
    width: 2,
    height: 1,
    rgba: Uint8ClampedArray.from([10, 20, 30, 255, 40, 50, 60, 128]),
    opacity: 128,
    blend: 'multiply',
    clip: true,
    visible: false,
  };
  const file = encodePsd(w, h, [layer], composite, 300);

  it('has the header of an RGB, 8-bit Photoshop file of that size', () => {
    expect(String.fromCharCode(...file.subarray(0, 4))).toBe('8BPS');
    expect(u16(file, 4)).toBe(1);
    expect(u16(file, 12)).toBe(3);
    expect(u32(file, 14)).toBe(h);
    expect(u32(file, 18)).toBe(w);
    expect(u16(file, 22)).toBe(8);
    expect(u16(file, 24)).toBe(3);
  });

  it('declares its print resolution', () => {
    const resources = 26 + 4;
    expect(u16(file, resources + 8)).toBe(0x03ed);
    expect(u32(file, resources + 16) / 65536).toBe(300);
  });

  it('writes the layer with its place, blend, opacity, clipping, visibility and name', () => {
    const resources = 26 + 4;
    const afterResources = resources + 4 + u32(file, resources);
    const info = afterResources + 8;
    expect(u32(file, afterResources) - 8).toBe(u32(file, info - 4));
    expect(u16(file, info)).toBe(1);
    const rec = info + 2;
    expect([u32(file, rec), u32(file, rec + 4), u32(file, rec + 8), u32(file, rec + 12)]).toEqual([0, 1, 1, 3]);
    expect(u16(file, rec + 16)).toBe(4);
    const blendAt = rec + 18 + 4 * 6;
    expect(String.fromCharCode(...file.subarray(blendAt, blendAt + 8))).toBe('8BIMmul ');
    expect(file[blendAt + 8]).toBe(128);
    expect(file[blendAt + 9]).toBe(1);
    expect(file[blendAt + 10]).toBe(2);
    const nameAt = blendAt + 12 + 4 + 4 + 4;
    expect(String.fromCharCode(...file.subarray(nameAt + 1, nameAt + 1 + file[nameAt]))).toBe('Texto 1');
  });

  it('its channels read back through RLE: alpha first, then red', () => {
    const resources = 26 + 4;
    const afterResources = resources + 4 + u32(file, resources);
    const info = afterResources + 8;
    const rec = info + 2;
    const blendAt = rec + 18 + 4 * 6;
    const extra = u32(file, blendAt + 12);
    const data = blendAt + 16 + extra;
    expect(u16(file, data)).toBe(1);
    expect(unpack(file, data + 2 + 2, 2)).toEqual([255, 128]);
    const alphaSize = u32(file, rec + 18 + 2);
    expect(unpack(file, data + alphaSize + 2 + 2, 2)).toEqual([10, 40]);
  });
});

describe('opaqueBounds', () => {
  it('finds the visible box, and none in an empty layer', () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    rgba[(1 * 4 + 2) * 4 + 3] = 10;
    expect(opaqueBounds(rgba, 4, 4)).toEqual({ left: 2, top: 1, width: 1, height: 1 });
    expect(opaqueBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
  });
});

describe('print proof', () => {
  it('white stays paper, black is ink, and pure cyan falls back to what ink can do', () => {
    const px = Uint8ClampedArray.from([255, 255, 255, 255, 0, 0, 0, 255, 0, 255, 255, 255]);
    proofCmyk(px);
    expect([...px.subarray(0, 3)]).toEqual([255, 255, 255]);
    expect([...px.subarray(4, 7)]).toEqual([35, 31, 32]);
    expect([...px.subarray(8, 11)]).toEqual([0, 174, 239]);
  });
});

describe('Adobe RGB', () => {
  it('keeps neutrals neutral, pulls saturated green inside its wider gamut', () => {
    const px = Uint8ClampedArray.from([128, 128, 128, 255, 0, 255, 0, 255, 255, 255, 255, 255]);
    srgbToAdobeRgb(px);
    expect(Math.abs(px[0] - px[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(px[1] - px[2])).toBeLessThanOrEqual(1);
    expect(px[4]).toBeGreaterThan(130);
    expect(px[5]).toBe(255);
    expect([...px.subarray(8, 11)]).toEqual([255, 255, 255]);
  });

  it('its profile is a valid ICC header with consistent tags', () => {
    const p = adobeRgbProfile();
    expect(u32(p, 0)).toBe(p.length);
    expect(String.fromCharCode(...p.subarray(36, 40))).toBe('acsp');
    expect(String.fromCharCode(...p.subarray(16, 20))).toBe('RGB ');
    const count = u32(p, 128);
    expect(count).toBe(9);
    for (let i = 0; i < count; i += 1) {
      const end = u32(p, 132 + i * 12 + 4) + u32(p, 132 + i * 12 + 8);
      expect(end).toBeLessThanOrEqual(p.length);
    }
  });

  it('goes into a JPEG after its first segment', () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 1, 2, 0xff, 0xda]);
    const out = setJpegIcc(jpeg, Uint8Array.of(9, 9));
    expect([out[8], out[9]]).toEqual([0xff, 0xe2]);
    expect(String.fromCharCode(...out.subarray(12, 23))).toBe('ICC_PROFILE');
    expect([...out.subarray(-2)]).toEqual([0xff, 0xda]);
  });

  it('replaces the profile a JPEG already has, so readers do not see two', () => {
    const icc = (byte: number) => {
      const tag = [...Array.from('ICC_PROFILE', (c) => c.charCodeAt(0)), 0, 1, 1, byte];
      return [0xff, 0xe2, 0, tag.length + 2, ...tag];
    };
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 1, 2, ...icc(1), 0xff, 0xdb, 0, 3, 5, 0xff, 0xda, 7]);
    const out = setJpegIcc(jpeg, Uint8Array.of(9));
    const text = String.fromCharCode(...out);
    expect(text.split('ICC_PROFILE')).toHaveLength(2);
    expect(out.indexOf(9)).toBeGreaterThan(0);
    expect(out.includes(1, 26)).toBe(false);
    expect([...out.subarray(-3)]).toEqual([0xff, 0xda, 7]);
  });

  it('goes into a PNG right after IHDR, replacing its colour chunks', () => {
    const chunk = (tag: string, body: number[]) => [0, 0, 0, body.length, ...Array.from(tag, (c) => c.charCodeAt(0)), ...body, 0, 0, 0, 0];
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', [1]), ...chunk('sRGB', [0]), ...chunk('IDAT', [2])]);
    const out = setPngIcc(png, Uint8Array.of(7));
    const text = String.fromCharCode(...out);
    expect(text.indexOf('iCCP')).toBeGreaterThan(text.indexOf('IHDR'));
    expect(text.indexOf('iCCP')).toBeLessThan(text.indexOf('IDAT'));
    expect(text).not.toContain('sRGB');
  });
});

describe('encodePsd with a layer mask', () => {
  const w = 2;
  const h = 2;
  const rgba = new Uint8ClampedArray(w * h * 4).fill(200);
  const layer: PsdLayer = { name: 'Mascara', left: 0, top: 0, width: w, height: h, rgba, opacity: 255, blend: 'source-over', clip: false, visible: true };
  const plain = encodePsd(w, h, [layer], rgba, 72);
  const masked = encodePsd(w, h, [{ ...layer, mask: rgba }], rgba, 72);
  const recordAt = (b: Uint8Array) => {
    for (let i = 0; i + 8 < b.length; i += 1) {
      if (String.fromCharCode(...b.subarray(i, i + 8)) === '8BIMnorm') return i;
    }
    return -1;
  };

  it('writes the mask box in the extra data, and its channel', () => {
    const at = recordAt(masked);
    expect(u32(masked, at + 12)).toBe(u32(plain, recordAt(plain) + 12) + 20);
    expect(u32(masked, at + 16)).toBe(20);
    expect(u32(masked, at + 28)).toBe(h);
    expect(u32(masked, at + 32)).toBe(w);
    expect(masked.length).toBeGreaterThan(plain.length);
  });
});
