import {
  applyAdjustmentsRGB,
  applyCurvesRGB,
  applyFullAdjustmentsRGB,
  toUniforms,
  toFullUniforms,
  DEFAULT_DETAIL,
  DEFAULT_SELECTIVE,
  DEFAULT_CURVES,
  CURVE_IDENTITY,
} from '@modules/photo-editor/color/colorAdjustments';

const IDENTITY = toUniforms({
  temperatura: 0,
  tint: 0,
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
      tint: 0,
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
      tint: 0,
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

  it('positive tint (RF-003 white balance) pushes toward magenta: green down, red/blue up', () => {
    const uniforms = toUniforms({
      temperatura: 0,
      tint: 100,
      matiz: 0,
      saturacao: 0,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 0,
    });
    const [r, g, b] = applyAdjustmentsRGB(0.5, 0.5, 0.5, uniforms);
    expect(g).toBeLessThan(0.5);
    expect(r).toBeGreaterThan(0.5);
    expect(b).toBeGreaterThan(0.5);
  });

  it('negative tint pushes toward green', () => {
    const uniforms = toUniforms({
      temperatura: 0,
      tint: -100,
      matiz: 0,
      saturacao: 0,
      luminosidade: 0,
      vibracao: 0,
      exposicao: 0,
    });
    const [, g] = applyAdjustmentsRGB(0.5, 0.5, 0.5, uniforms);
    expect(g).toBeGreaterThan(0.5);
  });

  it('saturation of -100 desaturates fully to a neutral gray', () => {
    const uniforms = toUniforms({
      temperatura: 0,
      tint: 0,
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
      tint: 0,
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
  tint: 0,
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

describe('applyCurvesRGB (RF-029 tone curves)', () => {
  const identityUniforms = {
    curveMasterY1: CURVE_IDENTITY.y1,
    curveMasterY2: CURVE_IDENTITY.y2,
    curveRY1: CURVE_IDENTITY.y1,
    curveRY2: CURVE_IDENTITY.y2,
    curveGY1: CURVE_IDENTITY.y1,
    curveGY2: CURVE_IDENTITY.y2,
    curveBY1: CURVE_IDENTITY.y1,
    curveBY2: CURVE_IDENTITY.y2,
  };

  it('is a no-op at the identity curve for every channel', () => {
    const [r, g, b] = applyCurvesRGB(0.2, 0.5, 0.9, identityUniforms);
    expectClose(r, 0.2);
    expectClose(g, 0.5);
    expectClose(b, 0.9);
  });

  it('a raised master shadow point lifts all three channels equally', () => {
    const uniforms = { ...identityUniforms, curveMasterY1: 0.6 };
    // Input sits exactly at the curve's x=1/3 control point, so it reads back as y1.
    const [r, g, b] = applyCurvesRGB(1 / 3, 1 / 3, 1 / 3, uniforms);
    expectClose(r, 0.6);
    expectClose(g, 0.6);
    expectClose(b, 0.6);
  });

  it('a per-channel curve only affects its own channel', () => {
    const uniforms = { ...identityUniforms, curveRY2: 0.9 };
    const [r, g, b] = applyCurvesRGB(2 / 3, 2 / 3, 2 / 3, uniforms);
    expectClose(r, 0.9);
    expectClose(g, 2 / 3);
    expectClose(b, 2 / 3);
  });
});

describe('applyFullAdjustmentsRGB (histogram pipeline mirrors the full shader)', () => {
  const fullIdentity = toFullUniforms(
    IDENTITY_BASIC,
    DEFAULT_DETAIL,
    DEFAULT_SELECTIVE,
    DEFAULT_CURVES
  );

  it('is a no-op when every stage is at its default', () => {
    const [r, g, b] = applyFullAdjustmentsRGB(0.6, 0.3, 0.1, fullIdentity);
    expectClose(r, 0.6);
    expectClose(g, 0.3);
    expectClose(b, 0.1);
  });

  it('applies both curves and selective color together', () => {
    const uniforms = toFullUniforms(
      IDENTITY_BASIC,
      DEFAULT_DETAIL,
      { ...DEFAULT_SELECTIVE, colorIndex: 3 }, // Verde
      { ...DEFAULT_CURVES, master: { y1: 0.5, y2: 2 / 3 } }
    );
    // A red pixel (far from green hue) should end up desaturated by the selective stage,
    // after having its shadows lifted by the master curve.
    const [r, g, b] = applyFullAdjustmentsRGB(0.5, 0.1, 0.1, uniforms);
    expectClose(r, g, 0.05);
    expectClose(g, b, 0.05);
  });
});
