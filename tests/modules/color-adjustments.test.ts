import {
  applyAdjustmentsRGB,
  toUniforms,
  toFullUniforms,
  DEFAULT_DETAIL,
  DEFAULT_SELECTIVE,
} from '@modules/photo-editor/color/colorAdjustments';

const IDENTITY = toUniforms({
  temperatura: 0,
  matiz: 0,
  saturacao: 0,
  luminosidade: 0,
  vibracao: 0,
  exposicao: 0,
});

function expectClose(a: number, b: number, epsilon = 0.01) {
  expect(Math.abs(a - b)).toBeLessThan(epsilon);
}

describe('colorAdjustments', () => {
  it('is a no-op at all-zero adjustments (RGB round-trips through HSL)', () => {
    const [r, g, b] = applyAdjustmentsRGB(0.6, 0.3, 0.1, IDENTITY);
    expectClose(r, 0.6);
    expectClose(g, 0.3);
    expectClose(b, 0.1);
  });

  it('exposure doubles linear brightness for +1 stop, clamped to 1', () => {
    const uniforms = toUniforms({
      temperatura: 0,
      matiz: 0,
      saturacao: 0,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 1,
    });
    const [r, g, b] = applyAdjustmentsRGB(0.2, 0.3, 0.4, uniforms);
    expectClose(r, 0.4);
    expectClose(g, 0.6);
    expectClose(b, 0.8);
  });

  it('warm temperature pushes red up and blue down', () => {
    const uniforms = toUniforms({
      temperatura: 100,
      matiz: 0,
      saturacao: 0,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 0,
    });
    const [r, , b] = applyAdjustmentsRGB(0.5, 0.5, 0.5, uniforms);
    expect(r).toBeGreaterThan(0.5);
    expect(b).toBeLessThan(0.5);
  });

  it('saturation of -100 desaturates fully to a neutral gray', () => {
    const uniforms = toUniforms({
      temperatura: 0,
      matiz: 0,
      saturacao: -100,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 0,
    });
    const [r, g, b] = applyAdjustmentsRGB(0.8, 0.2, 0.2, uniforms);
    expectClose(r, g);
    expectClose(g, b);
  });

  it('luminosity offset raises lightness without changing hue', () => {
    const uniforms = toUniforms({
      temperatura: 0,
      matiz: 0,
      saturacao: 0,
      luminosidade: 100,
      vibracao: 0,
      exposicao: 0,
    });
    const [r, g, b] = applyAdjustmentsRGB(0.2, 0.4, 0.6, uniforms);
    // luminosidade: 100 -> +0.5 lightness, which pushes this dark-ish color toward white.
    expect(r).toBeGreaterThan(0.2);
    expect(g).toBeGreaterThan(0.4);
    expect(b).toBeGreaterThan(0.6);
  });
});

const IDENTITY_BASIC = {
  temperatura: 0,
  matiz: 0,
  saturacao: 0,
  luminosidade: 0,
  vibracao: 0,
  exposicao: 0,
};

describe('toFullUniforms (RF-063 detail + RF-059 selective color)', () => {
  it('leaves detail/selective uniforms at zero-effect defaults when untouched', () => {
    const u = toFullUniforms(IDENTITY_BASIC, DEFAULT_DETAIL, DEFAULT_SELECTIVE);
    expect(u.sharpenAmount).toBe(0);
    expect(u.noiseReduction).toBe(0);
    expect(u.lumaNoiseReduction).toBe(0);
    expect(u.selectiveActive).toBe(0);
  });

  it('maps nitidez/reducaoRuido/luminancia sliders to 0..1 shader uniforms', () => {
    const u = toFullUniforms(
      IDENTITY_BASIC,
      { nitidez: 50, raio: 5, reducaoRuido: 25, luminancia: 100 },
      DEFAULT_SELECTIVE
    );
    expect(u.sharpenAmount).toBeCloseTo(0.5);
    expect(u.sharpenRadius).toBeCloseTo(10);
    expect(u.noiseReduction).toBeCloseTo(0.25);
    expect(u.lumaNoiseReduction).toBeCloseTo(1);
  });

  it('activates the selective-color band only once a color is chosen', () => {
    const none = toFullUniforms(IDENTITY_BASIC, DEFAULT_DETAIL, DEFAULT_SELECTIVE);
    expect(none.selectiveActive).toBe(0);
    expect(none.selectiveDesaturateOthers).toBe(0);

    // Index 3 is 'Verde' (green) — see SELECTIVE_HUES_DEG.
    const green = toFullUniforms(IDENTITY_BASIC, DEFAULT_DETAIL, {
      ...DEFAULT_SELECTIVE,
      colorIndex: 3,
    });
    expect(green.selectiveActive).toBe(1);
    expect(green.selectiveDesaturateOthers).toBe(1);
    expect(green.selectiveHue).toBeCloseTo(120 / 360);
  });
});
