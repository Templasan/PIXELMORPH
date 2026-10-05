import { createClip, clipDurationMs, type Track } from '../../src/modules/video-editor/domain/Track';
import { planExport } from '../../src/modules/video-editor/domain/exportPlan';
import { trimClipOut, trimClipIn } from '../../src/modules/video-editor/domain/timeline';
import { advancePlayhead, loopBounds } from '../../src/modules/video-editor/domain/loopRange';

const mk = (over: Record<string, unknown> & { startMs: number }) =>
  createClip({
    name: 'c',
    sourceUri: 'file:///a.mp4',
    color: '#fff',
    sourceDurationMs: 10_000,
    ...over,
  } as any);
const tr = (clips: ReturnType<typeof createClip>[]): Track => ({
  id: 'v',
  name: 'V',
  kind: 'video',
  visible: true,
  locked: false,
  clips,
});

describe('video edge cases', () => {
  it('zero-duration clip has zero length', () => {
    const z = { ...mk({ startMs: 0 }), inPointMs: 3000, outPointMs: 3000 };
    expect(clipDurationMs(z)).toBe(0);
    const plan = planExport([tr([z, mk({ startMs: 0 })])]);
    plan.clips.forEach((c) => expect(Number.isFinite(c.outMs)).toBe(true));
    expect(plan.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('trim past the source end / before the start is clamped', () => {
    const c = mk({ startMs: 0, inPointMs: 0, outPointMs: 5000 });
    const t = tr([c]);
    expect(trimClipOut([t], 'v', c.id, 50_000)[0].clips[0].outPointMs).toBe(10_000);
    const inn = trimClipIn([t], 'v', c.id, 99_000)[0].clips[0];
    expect(inn.inPointMs).toBeLessThan(inn.outPointMs);
  });

  it('speed ramp: durations scale by 1/speed', () => {
    const slow = { ...mk({ startMs: 0, outPointMs: 2000 }), speed: 0.5 };
    const fast = { ...mk({ startMs: 4000, outPointMs: 8000 }), speed: 4 };
    expect(clipDurationMs(slow)).toBe(4000);
    expect(clipDurationMs(fast)).toBe(2000);
    expect(planExport([tr([slow, fast])]).durationMs).toBe(6000);
  });

  it('review loop wraps inside the selected clip; scrubbed outside is not trapped', () => {
    const loop = loopBounds({ startMs: 1000, endMs: 3000 }, 9000);
    expect(advancePlayhead(2950, 100, 9000, loop)).toEqual({ timeMs: 1000, ended: false });
    expect(advancePlayhead(5000, 100, 9000, loop)).toEqual({ timeMs: 5100, ended: false });
    expect(advancePlayhead(8950, 100, 9000, loop)).toEqual({ timeMs: 9000, ended: true });
    expect(advancePlayhead(0, 100, 9000, loop)).toEqual({ timeMs: 100, ended: false });
  });

  it('empty timeline loop is [0,0] and ends immediately', () => {
    expect(loopBounds(null, 0)).toEqual({ startMs: 0, endMs: 0 });
    expect(advancePlayhead(0, 50, 0, null).ended).toBe(true);
  });
});
