import { createClip, clipDurationMs, clipEndMs, type Track } from '@modules/video-editor/Track';
import {
  trackDurationMs,
  timelineDurationMs,
  moveClip,
  trimClipIn,
  trimClipOut,
  splitClipAtMs,
  appendClip,
  removeClip,
  findClip,
  rippleShiftAfter,
  MIN_CLIP_DURATION_MS,
} from '@modules/video-editor/timeline';
import {
  msToFrame,
  frameToMs,
  stepFrameMs,
  formatTimecode,
  DEFAULT_FPS,
} from '@modules/video-editor/frameMath';
import {
  clampTransitionDurationMs,
  setTransition,
  previousClipOf,
} from '@modules/video-editor/transitions';
import { insertFreezeFrame } from '@modules/video-editor/freezeFrame';

function makeTrack(id: string, clips: ReturnType<typeof createClip>[]): Track {
  return { id, name: id, kind: 'video', visible: true, locked: false, clips };
}

describe('Track / clipDurationMs / clipEndMs', () => {
  it('a normal clip duration is outPoint - inPoint', () => {
    const clip = createClip({
      name: 'A',
      sourceUri: 'a.mp4',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 10000,
      inPointMs: 1000,
      outPointMs: 4000,
    });
    expect(clipDurationMs(clip)).toBe(3000);
    expect(clipEndMs(clip)).toBe(3000);
  });

  it('a frozen clip duration comes from holdMs, not in/out points', () => {
    const clip = {
      ...createClip({
        name: 'F',
        sourceUri: 'a.mp4',
        color: '#fff',
        startMs: 5000,
        sourceDurationMs: 10000,
        inPointMs: 2000,
        outPointMs: 2000,
      }),
      frozen: true,
      holdMs: 1500,
    };
    expect(clipDurationMs(clip)).toBe(1500);
    expect(clipEndMs(clip)).toBe(6500);
  });
});

describe('trackDurationMs / timelineDurationMs', () => {
  it('is the furthest clip end on the track', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 5000,
    });
    const b = createClip({
      name: 'B',
      sourceUri: 'b',
      color: '#fff',
      startMs: 5000,
      sourceDurationMs: 3000,
    });
    const track = makeTrack('t1', [a, b]);
    expect(trackDurationMs(track)).toBe(8000);
  });

  it('timelineDurationMs is the max across all tracks', () => {
    const short = makeTrack('t1', [
      createClip({ name: 'A', sourceUri: 'a', color: '#fff', startMs: 0, sourceDurationMs: 2000 }),
    ]);
    const long = makeTrack('t2', [
      createClip({ name: 'B', sourceUri: 'b', color: '#fff', startMs: 0, sourceDurationMs: 9000 }),
    ]);
    expect(timelineDurationMs([short, long])).toBe(9000);
  });
});

describe('moveClip', () => {
  it('moves freely into empty space', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 2000,
    });
    const track = makeTrack('t1', [a]);
    const result = moveClip([track], 't1', a.id, 5000);
    expect(result[0].clips[0].startMs).toBe(5000);
  });

  it('never goes negative', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 1000,
      sourceDurationMs: 2000,
    });
    const track = makeTrack('t1', [a]);
    const result = moveClip([track], 't1', a.id, -500);
    expect(result[0].clips[0].startMs).toBe(0);
  });

  it('snaps against a neighbor instead of overlapping it', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 2000,
    });
    const b = createClip({
      name: 'B',
      sourceUri: 'b',
      color: '#fff',
      startMs: 5000,
      sourceDurationMs: 2000,
    });
    const track = makeTrack('t1', [a, b]);
    // Drag A to overlap B's start (5000) — should snap to just before B (3000) since that's closer.
    const result = moveClip([track], 't1', a.id, 4200);
    const clipA = result[0].clips.find((c) => c.id === a.id)!;
    expect(clipEndMs(clipA)).toBeLessThanOrEqual(5000);
  });

  it('reorders clips by dragging one past another', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 1000,
    });
    const b = createClip({
      name: 'B',
      sourceUri: 'b',
      color: '#fff',
      startMs: 1000,
      sourceDurationMs: 1000,
    });
    const track = makeTrack('t1', [a, b]);
    // Drag A well past B's start (closer to landing after B than snapping back before it).
    const result = moveClip([track], 't1', a.id, 1500);
    const clipA = result[0].clips.find((c) => c.id === a.id)!;
    const clipB = result[0].clips.find((c) => c.id === b.id)!;
    expect(clipA.startMs).toBeGreaterThanOrEqual(clipEndMs(clipB) - 1);
  });
});

describe('trimClipIn / trimClipOut', () => {
  it('trimming the in-point keeps the out-point fixed and shortens duration', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 10000,
      inPointMs: 0,
      outPointMs: 5000,
    });
    const track = makeTrack('t1', [a]);
    const result = trimClipIn([track], 't1', a.id, 2000);
    const clip = result[0].clips[0];
    expect(clip.inPointMs).toBe(2000);
    expect(clip.outPointMs).toBe(5000);
    expect(clipDurationMs(clip)).toBe(3000);
  });

  it('trimming the in-point never shrinks below MIN_CLIP_DURATION_MS', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 10000,
      inPointMs: 0,
      outPointMs: 1000,
    });
    const track = makeTrack('t1', [a]);
    const result = trimClipIn([track], 't1', a.id, 999);
    const clip = result[0].clips[0];
    expect(clipDurationMs(clip)).toBeGreaterThanOrEqual(MIN_CLIP_DURATION_MS);
  });

  it('trimming the out-point cannot exceed the source duration', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 5000,
      inPointMs: 0,
      outPointMs: 3000,
    });
    const track = makeTrack('t1', [a]);
    const result = trimClipOut([track], 't1', a.id, 99999);
    expect(result[0].clips[0].outPointMs).toBe(5000);
  });

  it('trimming the out-point cannot push past the next clip', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 10000,
      inPointMs: 0,
      outPointMs: 2000,
    });
    const b = createClip({
      name: 'B',
      sourceUri: 'b',
      color: '#fff',
      startMs: 3000,
      sourceDurationMs: 5000,
    });
    const track = makeTrack('t1', [a, b]);
    const result = trimClipOut([track], 't1', a.id, 9000);
    const clip = result[0].clips.find((c) => c.id === a.id)!;
    expect(clipEndMs(clip)).toBeLessThanOrEqual(3000);
  });
});

describe('splitClipAtMs', () => {
  it('splits into two clips sharing the same source with correct in/out ranges', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 10000,
      inPointMs: 1000,
      outPointMs: 5000,
    });
    const track = makeTrack('t1', [a]);
    const result = splitClipAtMs([track], 't1', a.id, 2000); // 2000ms into the track = source ms 3000
    expect(result[0].clips).toHaveLength(2);
    const [first, second] = [...result[0].clips].sort((x, y) => x.startMs - y.startMs);
    expect(first.outPointMs).toBe(3000);
    expect(second.inPointMs).toBe(3000);
    expect(second.startMs).toBe(2000);
    expect(clipEndMs(first)).toBe(second.startMs);
  });

  it('refuses to split too close to either edge', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 10000,
      outPointMs: 300,
    });
    const track = makeTrack('t1', [a]);
    const result = splitClipAtMs([track], 't1', a.id, 50);
    expect(result[0].clips).toHaveLength(1);
  });
});

describe('appendClip / removeClip / findClip', () => {
  it('appends immediately after the current track end (no gap)', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 3000,
    });
    const track = makeTrack('t1', [a]);
    const b = createClip({
      name: 'B',
      sourceUri: 'b',
      color: '#fff',
      startMs: 999,
      sourceDurationMs: 2000,
    });
    const result = appendClip([track], 't1', b);
    const appended = result[0].clips.find((c) => c.id === b.id)!;
    expect(appended.startMs).toBe(3000);
  });

  it('removeClip drops the clip; findClip locates it across tracks', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 3000,
    });
    const track = makeTrack('t1', [a]);
    expect(findClip([track], a.id)?.clip.id).toBe(a.id);
    const result = removeClip([track], 't1', a.id);
    expect(result[0].clips).toHaveLength(0);
    expect(findClip(result, a.id)).toBeNull();
  });
});

describe('rippleShiftAfter', () => {
  it('shifts every clip at/after the cut point by the delta', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 2000,
    });
    const b = createClip({
      name: 'B',
      sourceUri: 'b',
      color: '#fff',
      startMs: 2000,
      sourceDurationMs: 3000,
    });
    const track = makeTrack('t1', [a, b]);
    const result = rippleShiftAfter([track], 't1', 2000, -500);
    expect(result[0].clips.find((c) => c.id === a.id)?.startMs).toBe(0);
    expect(result[0].clips.find((c) => c.id === b.id)?.startMs).toBe(1500);
  });

  it('never shifts a clip before the cut point', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 2000,
    });
    const track = makeTrack('t1', [a]);
    const result = rippleShiftAfter([track], 't1', 5000, -500);
    expect(result[0].clips[0].startMs).toBe(0);
  });

  it('clamps at zero rather than going negative', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 100,
      sourceDurationMs: 2000,
    });
    const track = makeTrack('t1', [a]);
    const result = rippleShiftAfter([track], 't1', 0, -500);
    expect(result[0].clips[0].startMs).toBe(0);
  });
});

describe('frameMath', () => {
  it('msToFrame / frameToMs round-trip at the default fps', () => {
    expect(msToFrame(1000, DEFAULT_FPS)).toBe(30);
    expect(frameToMs(30, DEFAULT_FPS)).toBe(1000);
  });

  it('stepFrameMs advances by exactly one frame and clamps to [0, maxMs]', () => {
    const oneFrameMs = 1000 / DEFAULT_FPS;
    expect(stepFrameMs(0, 1, 5000)).toBeCloseTo(oneFrameMs);
    expect(stepFrameMs(0, -1, 5000)).toBe(0);
    expect(stepFrameMs(4990, 1, 5000)).toBe(5000);
  });

  it('formatTimecode renders HH:MM:SS:FF', () => {
    expect(formatTimecode(0)).toBe('00:00:00:00');
    expect(formatTimecode(65_500, 30)).toBe('00:01:05:15');
  });
});

describe('transitions', () => {
  it('clamps a transition to half of the shorter neighboring clip', () => {
    const prev = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 1000,
    }); // 1000ms
    const clip = createClip({
      name: 'B',
      sourceUri: 'b',
      color: '#fff',
      startMs: 1000,
      sourceDurationMs: 400,
    }); // 400ms
    expect(clampTransitionDurationMs(1000, prev, clip)).toBe(200);
  });

  it('setTransition attaches to the target clip only', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 1000,
    });
    const b = createClip({
      name: 'B',
      sourceUri: 'b',
      color: '#fff',
      startMs: 1000,
      sourceDurationMs: 1000,
    });
    const track = makeTrack('t1', [a, b]);
    const result = setTransition([track], 't1', b.id, { type: 'fade', durationMs: 300 });
    expect(result[0].clips.find((c) => c.id === b.id)?.transitionIn?.type).toBe('fade');
    expect(result[0].clips.find((c) => c.id === a.id)?.transitionIn).toBeUndefined();
  });

  it('previousClipOf finds the clip immediately before by startMs', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 1000,
    });
    const b = createClip({
      name: 'B',
      sourceUri: 'b',
      color: '#fff',
      startMs: 1000,
      sourceDurationMs: 1000,
    });
    const track = makeTrack('t1', [a, b]);
    expect(previousClipOf(track, b)?.id).toBe(a.id);
    expect(previousClipOf(track, a)).toBeNull();
  });
});

describe('insertFreezeFrame', () => {
  it('splits the clip and inserts a held segment of the requested duration', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 10000,
      outPointMs: 5000,
    });
    const track = makeTrack('t1', [a]);
    const result = insertFreezeFrame([track], 't1', a.id, 2000, 1500);
    expect(result[0].clips).toHaveLength(3);
    const frozen = result[0].clips.find((c) => c.frozen);
    expect(frozen).toBeDefined();
    expect(clipDurationMs(frozen!)).toBe(1500);
    expect(frozen!.startMs).toBe(2000);
  });

  it('ripples later clips on the same track forward by the hold duration', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 10000,
      outPointMs: 5000,
    });
    const b = createClip({
      name: 'B',
      sourceUri: 'b',
      color: '#fff',
      startMs: 5000,
      sourceDurationMs: 2000,
    });
    const track = makeTrack('t1', [a, b]);
    const result = insertFreezeFrame([track], 't1', a.id, 2000, 1000);
    const clipB = result[0].clips.find((c) => c.id === b.id)!;
    expect(clipB.startMs).toBe(6000);
  });

  it('ripples clips on other tracks that start after the freeze point', () => {
    const a = createClip({
      name: 'A',
      sourceUri: 'a',
      color: '#fff',
      startMs: 0,
      sourceDurationMs: 10000,
      outPointMs: 5000,
    });
    const text = createClip({
      name: 'T',
      sourceUri: 't',
      color: '#fff',
      startMs: 3000,
      sourceDurationMs: 1000,
    });
    const videoTrack = makeTrack('t1', [a]);
    const textTrack = makeTrack('t2', [text]);
    const result = insertFreezeFrame([videoTrack, textTrack], 't1', a.id, 2000, 800);
    const clipText = result[1].clips.find((c) => c.id === text.id)!;
    expect(clipText.startMs).toBe(3800);
  });
});
