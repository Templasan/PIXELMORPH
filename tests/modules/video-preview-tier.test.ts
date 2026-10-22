import {
  autoTier,
  createDropMonitor,
  isSustainedDrop,
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

  it('drops 4K sources to Média in Automática even with 8 GB and hardware decode', () => {
    // 8 GB + hw1080 would pick Alta, but a 4K source starts at Média to avoid 4K decode cost.
    expect(autoTier({ deviceMemoryGb: 8, hardware1080: true }, 2160)).toBe('media');
    expect(autoTier({ deviceMemoryGb: 8, hardware1080: true }, 3840)).toBe('media');
    // Baixa always stays Baixa for 4K.
    expect(autoTier({ deviceMemoryGb: 3, hardware1080: true }, 2160)).toBe('baixa');
    // 1080p sources are unchanged.
    expect(autoTier({ deviceMemoryGb: 8, hardware1080: true }, 1080)).toBe('alta');
    expect(autoTier({ deviceMemoryGb: 4, hardware1080: true }, 720)).toBe('media');
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
