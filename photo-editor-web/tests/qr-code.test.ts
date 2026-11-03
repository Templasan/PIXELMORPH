import { isValidQRContent, qrModules, readQr } from '../src/domain/QRCode';

/** Draws modules as a scanner would see them, with the quiet zone. */
function render(modules: boolean[][], k = 6, quiet = 4) {
  const side = (modules.length + quiet * 2) * k;
  const rgba = new Uint8ClampedArray(side * side * 4).fill(255);
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let py = 0; py < k; py += 1)
        for (let px = 0; px < k; px += 1) {
          const i = (((y + quiet) * k + py) * side + (x + quiet) * k + px) * 4;
          rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
        }
    })
  );
  return { rgba, side };
}

describe('QR code', () => {
  it('what is generated reads back, accents included', () => {
    for (const content of ['https://example.com/a?b=1', 'Olá, coração']) {
      const { rgba, side } = render(qrModules(content));
      expect(readQr(rgba, side, side)).toBe(content);
    }
  });

  it('a picture without a code reads as nothing', () => {
    expect(readQr(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100)).toBeNull();
  });

  it('refuses empty content and overlong text', () => {
    expect(isValidQRContent('')).toBe(false);
    expect(() => qrModules('x'.repeat(4000))).toThrow();
  });
});
