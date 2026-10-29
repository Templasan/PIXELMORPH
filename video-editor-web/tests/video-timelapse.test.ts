import { describe, expect, it } from 'vitest';
import { timelapseClips } from '../src/domain/timelapse';
import { clipEndMs } from '../src/domain/Track';

const photos = ['a', 'b', 'c'].map((n) => ({ name: n, uri: `${n}.jpg` }));

describe('timelapseClips (RF-023)', () => {
  it('puts the photos back to back at the playhead, each for one step', () => {
    const clips = timelapseClips(photos, { startMs: 1000, stepMs: 500, color: '#000' });
    expect(clips.map((c) => c.startMs)).toEqual([1000, 1500, 2000]);
    expect(clips.map((c) => clipEndMs(c))).toEqual([1500, 2000, 2500]);
    expect(clips.map((c) => c.sourceUri)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(clips.every((c) => c.transitionIn === undefined)).toBe(true);
  });

  it('adds the transition to every photo after the first, clamped to half a photo', () => {
    const clips = timelapseClips(photos, { startMs: 0, stepMs: 400, color: '#000', transition: 'fade' });
    expect(clips[0].transitionIn).toBeUndefined();
    expect(clips[1].transitionIn).toEqual({ type: 'fade', durationMs: 200 });
    expect(clips[2].transitionIn).toEqual({ type: 'fade', durationMs: 200 });
  });
});
