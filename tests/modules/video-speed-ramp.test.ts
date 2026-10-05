import { createClip, clipEndMs, type Track } from '@modules/video-editor/domain/Track';
import { topClipAt } from '@modules/video-editor/domain/timeline';
import { applySpeedRamp } from '@modules/video-editor/domain/speedRamp';

const mk = (clips: Track['clips']): Track[] => [
  { id: 'v', name: 'V1', kind: 'video', visible: true, locked: false, clips },
];

describe('topClipAt at the end', () => {
  it('holds the last clip at and after the timeline end', () => {
    const a = createClip({
      name: 'a',
      sourceUri: 'a',
      color: '#000',
      startMs: 0,
      sourceDurationMs: 1000,
    });
    const tracks = mk([a]);
    expect(topClipAt(tracks, 1000)?.id).toBe(a.id);
  });
});

describe('applySpeedRamp', () => {
  const a = createClip({
    name: 'a',
    sourceUri: 'a',
    color: '#000',
    startMs: 0,
    sourceDurationMs: 20000,
  });
  const b = createClip({
    name: 'b',
    sourceUri: 'b',
    color: '#000',
    startMs: 10000,
    sourceDurationMs: 5000,
  });
  const base = mk([{ ...a, speed: 2 }, b]);

  it('splits the end into stepped clips, keeps source continuity and shifts neighbors', () => {
    const out = applySpeedRamp(base, 'v', a.id, 1, 1500, 'end');
    const clips = out[0].clips;
    const first = clips.filter((c) => c.sourceUri === 'a');
    expect(first).toHaveLength(5);
    expect(first[0].id).toBe(a.id);
    expect(first[0].inPointMs).toBe(0);
    expect(first[4].outPointMs).toBeCloseTo(20000);
    const speeds = first.slice(1).map((c) => c.speed as number);
    expect(speeds).toEqual([...speeds].sort((x, y) => y - x)); // eases 2x -> 1x
    first.slice(1).forEach((c, i) => expect(c.startMs).toBeCloseTo(clipEndMs(first[i])));
    const nb = clips.find((c) => c.id === b.id)!;
    expect(nb.startMs).toBeCloseTo(clipEndMs(first[4]));
  });

  it('is a no-op when the speed already matches or the stretch is too short', () => {
    expect(applySpeedRamp(mk([a]), 'v', a.id, 1, 1500, 'end')).toEqual(mk([a]));
    expect(applySpeedRamp(base, 'v', a.id, 1, 100, 'end')).toBe(base);
  });
});
