import {
  autoTier,
  createDropMonitor,
  isSustainedDrop,
  previewUriFor,
  resolveTier,
  stepDownTier,
} from '../../src/app/screens/video-editor/previewTier';

describe('preview tiers', () => {
  it('picks the automatic tier from device memory', () => {
    expect(autoTier({ deviceMemoryGb: 2, hardware1080: true })).toBe('baixa');
    expect(autoTier({ deviceMemoryGb: 3, hardware1080: true })).toBe('baixa');
    expect(autoTier({ deviceMemoryGb: 4, hardware1080: true })).toBe('media');
    expect(autoTier({ deviceMemoryGb: 6, hardware1080: true })).toBe('media');
    expect(autoTier({ deviceMemoryGb: 8, hardware1080: true })).toBe('alta');
  });

  it('never goes above Média without 1080p hardware decode, and guesses Média when unknown', () => {
    expect(autoTier({ deviceMemoryGb: 8, hardware1080: false })).toBe('media');
    expect(autoTier({ deviceMemoryGb: 2, hardware1080: false })).toBe('baixa');
    expect(autoTier({ deviceMemoryGb: undefined, hardware1080: true })).toBe('media');
  });

  it('steps down one tier and stops at Baixa', () => {
    expect(stepDownTier('alta')).toBe('media');
    expect(stepDownTier('media')).toBe('baixa');
    expect(stepDownTier('baixa')).toBe('baixa');
  });

  it('a manual choice wins; Automática applies the step down', () => {
    expect(resolveTier('alta', 'baixa', true)).toBe('alta');
    expect(resolveTier('auto', 'alta', false)).toBe('alta');
    expect(resolveTier('auto', 'alta', true)).toBe('media');
    expect(resolveTier('auto', 'baixa', true)).toBe('baixa');
  });
});

describe('drop monitor', () => {
  it('flags more than 10 % bad draws, not exactly 10 %', () => {
    expect(isSustainedDrop(100, 11)).toBe(true);
    expect(isSustainedDrop(100, 10)).toBe(false);
    expect(isSustainedDrop(10, 10)).toBe(false); // too few draws to judge
  });

  it('judges each 5 s window on its own', () => {
    const m = createDropMonitor();
    let hit = false;
    for (let t = 0; t < 4900; t += 33) hit = m.sample(t, 1) || hit;
    expect(hit).toBe(false); // the window is still open
    expect(m.sample(5000, 1)).toBe(true);
    for (let t = 5033; t < 9900; t += 33) hit = m.sample(t, 0) || hit;
    expect(hit).toBe(false);
    expect(m.sample(10000, 0)).toBe(false); // the next window was clean
  });

  it('a few late frames in a clean window do not trigger', () => {
    const m = createDropMonitor();
    let hit = false;
    for (let t = 0; t < 6000; t += 33) hit = m.sample(t, t % 660 === 0 ? 1 : 0) || hit;
    expect(hit).toBe(false);
  });
});

describe('previewUriFor', () => {
  const src = 'file:///docs/media/p/clip.mp4';
  const ready = (uri: string) => ({ status: 'ready', uri });

  it('Alta plays originals up to 1080p and the 1080p proxy above it', () => {
    expect(previewUriFor('alta', { [`${src}#1080`]: { status: 'none' } }, src)).toBe(src);
    expect(
      previewUriFor('alta', { [src]: ready('p720'), [`${src}#1080`]: ready('p1080') }, src)
    ).toBe('p1080');
  });

  it('Alta uses the 720p proxy while the 1080p one is unknown, running or failed', () => {
    expect(previewUriFor('alta', { [src]: ready('p720') }, src)).toBe('p720');
    expect(
      previewUriFor('alta', { [src]: ready('p720'), [`${src}#1080`]: { status: 'running' } }, src)
    ).toBe('p720');
    expect(previewUriFor('alta', { [`${src}#1080`]: { status: 'failed' } }, src)).toBe(src);
  });

  it('Média and Baixa keep their proxies', () => {
    const state = { [src]: ready('p720'), [`${src}#540`]: ready('p540') };
    expect(previewUriFor('media', state, src)).toBe('p720');
    expect(previewUriFor('baixa', state, src)).toBe('p540');
    expect(previewUriFor('baixa', { [src]: ready('p720') }, src)).toBe('p720');
  });
});
