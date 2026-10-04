import { advancePlayhead, loopBounds } from '../../src/modules/video-editor/loopRange';

describe('review loop (RF-035)', () => {
  it('loops the selected clip span, or the whole timeline when nothing is selected', () => {
    expect(loopBounds({ startMs: 2000, endMs: 5000 }, 9000)).toEqual({
      startMs: 2000,
      endMs: 5000,
    });
    expect(loopBounds(null, 9000)).toEqual({ startMs: 0, endMs: 9000 });
    expect(loopBounds({ startMs: 3000, endMs: 3000 }, 9000)).toEqual({ startMs: 0, endMs: 9000 });
  });

  it('wraps to the loop start instead of running to the end of the timeline', () => {
    const loop = { startMs: 2000, endMs: 5000 };
    expect(advancePlayhead(4950, 100, 9000, loop)).toEqual({ timeMs: 2000, ended: false });
    expect(advancePlayhead(3000, 100, 9000, loop)).toEqual({ timeMs: 3100, ended: false });
  });

  it('stops at the end of the timeline when not looping, and does not trap a scrubbed playhead', () => {
    expect(advancePlayhead(8950, 100, 9000, null)).toEqual({ timeMs: 9000, ended: true });
    const loop = { startMs: 2000, endMs: 5000 };
    expect(advancePlayhead(7000, 100, 9000, loop)).toEqual({ timeMs: 7100, ended: false });
  });
});
