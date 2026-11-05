import { createDropMonitor, isSustainedDrop } from '../src/engine/previewTier';

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
