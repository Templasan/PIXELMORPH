import { sceneOf, SCENE_LOOKS } from '../src/domain/scene';
import { blemishAlpha, faceRetouchOf, fixRedEyePixels, isRedEyePixel, redEyeShare } from '../src/domain/layers';
import { DEFAULT_ADJUSTMENTS } from '../src/domain/adjustments';

const label = (text: string, confidence = 0.9) => ({ text, confidence });

describe('sceneOf', () => {
  it('names each kind of photo from its labels', () => {
    expect(sceneOf([label('Sky'), label('Mountain')])?.kind).toBe('paisagem');
    expect(sceneOf([label('Food'), label('Fruit')])?.kind).toBe('comida');
    expect(sceneOf([label('Dog'), label('Pet')])?.kind).toBe('animais');
    expect(sceneOf([label('Building'), label('Skyscraper')])?.kind).toBe('urbano');
    expect(sceneOf([label('Smile'), label('Selfie')])?.kind).toBe('retrato');
  });

  it('the stronger votes win, and it says why', () => {
    const guess = sceneOf([label('Sky', 0.6), label('Dog', 0.95), label('Pet', 0.9)]);
    expect(guess?.kind).toBe('animais');
    expect(guess?.because).toEqual(['Dog', 'Pet']);
  });

  it('a large face makes it a portrait, a small one in a crowd does not', () => {
    expect(sceneOf([label('Sky')], [{ w: 0.3, h: 0.3 }])?.kind).toBe('retrato');
    expect(sceneOf([label('Sky')], [{ w: 0.05, h: 0.05 }])?.kind).toBe('paisagem');
  });

  it('gives no answer rather than a weak guess', () => {
    expect(sceneOf([])).toBeNull();
    expect(sceneOf([label('Toy')])).toBeNull();
    expect(sceneOf([label('Sky', 0.3)])).toBeNull();
  });

  it('every suggested look uses real adjustment fields', () => {
    for (const { look } of Object.values(SCENE_LOOKS)) {
      for (const field of Object.keys(look)) expect(field in DEFAULT_ADJUSTMENTS).toBe(true);
    }
  });
});

describe('red eye', () => {
  it('sees flash red, not skin, lips in shadow or a dark pupil', () => {
    expect(isRedEyePixel(200, 40, 40)).toBe(true);
    expect(isRedEyePixel(210, 150, 130)).toBe(false);
    expect(isRedEyePixel(50, 10, 10)).toBe(false);
    expect(isRedEyePixel(20, 20, 20)).toBe(false);
  });

  it('takes the red out and leaves the rest', () => {
    const px = Uint8ClampedArray.from([200, 40, 40, 255, 210, 150, 130, 255]);
    fixRedEyePixels(px);
    expect([...px.subarray(0, 3)]).toEqual([40, 40, 40]);
    expect([...px.subarray(4, 7)]).toEqual([210, 150, 130]);
  });

  it('measures how much of a region is red', () => {
    expect(redEyeShare(Uint8ClampedArray.from([200, 40, 40, 255, 0, 0, 0, 255]))).toBe(0.5);
  });
});

describe('blemishes', () => {
  const px = (v: number) => [v, v, v, 255];
  it('finds a small dark spot on even skin, and leaves features and even skin alone', () => {
    const sharp = Uint8ClampedArray.from([...px(180), ...px(160), ...px(60), ...px(190)]);
    const near = Uint8ClampedArray.from([...px(180), ...px(180), ...px(180), ...px(180)]);
    expect([...blemishAlpha(sharp, near)]).toEqual([0, 255, 0, 0]);
  });
});

describe('faceRetouchOf', () => {
  const face = { x: 0.2, y: 0.2, w: 0.4, h: 0.5, leftEye: { x: 0.3, y: 0.35 }, rightEye: { x: 0.5, y: 0.35 }, mouthLeft: { x: 0.3, y: 0.6 }, mouthRight: { x: 0.5, y: 0.6 }, mouthBottom: { x: 0.4, y: 0.64 } };
  it('finds the mouth from its landmarks and starts gently', () => {
    const f = faceRetouchOf(face);
    expect(f.mouth!.x).toBeCloseTo(0.4);
    expect(f.mouth!.w).toBeCloseTo(0.2);
    expect(f.eyes).toBe(0);
    expect(f.tone).toBe(0);
  });
  it('copes with a face turned too far to see its mouth', () => {
    expect(faceRetouchOf({ ...face, mouthLeft: null }).mouth).toBeNull();
  });
});
