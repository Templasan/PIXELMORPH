import { createClip, type Track } from '../../src/modules/video-editor/Track';
import {
  VIDEO_PRESETS,
  originalPreset,
  planExport,
} from '../../src/modules/video-editor/exportPlan';

const clip = (over: Partial<Parameters<typeof createClip>[0]> & { startMs: number }) =>
  createClip({
    name: 'c',
    sourceUri: 'file:///a.mp4',
    color: '#fff',
    sourceDurationMs: 10_000,
    ...over,
  });

const track = (clips: ReturnType<typeof createClip>[], over: Partial<Track> = {}): Track => ({
  id: 'v1',
  name: 'V1',
  kind: 'video',
  visible: true,
  locked: false,
  clips,
  ...over,
});

describe('planExport (US-16 / US-30)', () => {
  it('returns nothing for a timeline without video clips', () => {
    expect(planExport([])).toEqual({ clips: [], transitions: [], durationMs: 0 });
    expect(planExport([track([])])).toEqual({ clips: [], transitions: [], durationMs: 0 });
    expect(planExport([track([clip({ startMs: 0 })], { visible: false })]).clips).toHaveLength(0);
  });

  it('orders clips by start time and keeps trim, speed and rotation', () => {
    const late = { ...clip({ startMs: 5_000, inPointMs: 1_000, outPointMs: 3_000 }), speed: 2 };
    const early = { ...clip({ startMs: 0, inPointMs: 0, outPointMs: 4_000 }), rotation: 90 };
    const plan = planExport([track([late, early])]);

    expect(plan.clips.map((c) => [c.inMs, c.outMs])).toEqual([
      [0, 4_000],
      [1_000, 3_000],
    ]);
    expect(plan.clips[0].rotation).toBe(90);
    expect(plan.clips[1].speed).toBe(2);
    // 4 s + (2 s source at 2x = 1 s)
    expect(plan.durationMs).toBe(5_000);
  });

  it('turns a freeze frame into a still held for its duration', () => {
    const frozen = {
      ...clip({ startMs: 0, inPointMs: 2_500, outPointMs: 2_500 }),
      frozen: true,
      holdMs: 1_500,
    };
    const [piece] = planExport([track([frozen])]).clips;
    expect(piece).toMatchObject({ kind: 'still', stillTimeMs: 2_500, holdMs: 1_500 });
  });
});

describe('video presets (RF-017)', () => {
  it('has real social resolutions with a bitrate each', () => {
    for (const p of VIDEO_PRESETS) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.bitrate).toBeGreaterThan(0);
    }
    expect(VIDEO_PRESETS.find((p) => p.name === 'Instagram Reels')).toMatchObject({
      width: 1080,
      height: 1920,
    });
  });

  it('keeps the original shape, never upscales and caps 4K at Full HD', () => {
    expect(originalPreset(1280, 720)).toMatchObject({ width: 1280, height: 720 });
    const uhd = originalPreset(3840, 2160);
    expect(uhd).toMatchObject({ width: 1920, height: 1080 });
    expect(uhd.width % 2).toBe(0);
    expect(uhd.height % 2).toBe(0);
  });
});

describe('planExport transitions (RF-032)', () => {
  const withTransition = (
    c: ReturnType<typeof createClip>,
    type: 'fade' | 'slide' | 'zoom',
    durationMs: number
  ) => ({ ...c, transitionIn: { type, durationMs } });

  it('puts the transition on the incoming clip and points it at the last frame of the outgoing one', () => {
    const a = clip({ startMs: 0, inPointMs: 0, outPointMs: 4_000 });
    const b = withTransition(
      clip({ startMs: 4_000, inPointMs: 1_000, outPointMs: 6_000 }),
      'fade',
      500
    );
    const plan = planExport([track([a, b])]);

    expect(plan.transitions).toEqual([{ type: 'fade', atMs: 4_000, durationMs: 500 }]);
    expect(plan.clips[1]).toMatchObject({
      transitionIn: 'fade',
      transitionInMs: 500,
      outputMs: 5_000,
      transitionFrom: { sourceUri: a.sourceUri, timeMs: 3_950, rotation: 0 },
    });
    expect(plan.clips[0]).toMatchObject({
      transitionFrom: null,
      transitionIn: '',
      outputMs: 4_000,
      startMs: 0,
    });
    expect(plan.clips[1].startMs).toBe(4_000);
    // transitions happen inside the clips, so the video is not shortened
    expect(plan.durationMs).toBe(9_000);
  });

  it('a plain cut has no frame to lay over the next clip', () => {
    const a = clip({ startMs: 0, outPointMs: 4_000 });
    const b = withTransition(clip({ startMs: 4_000, outPointMs: 6_000 }), 'slide', 800);
    const plan = planExport([track([a, b])]);
    expect(plan.clips[0].transitionFrom).toBeNull();
    expect(plan.clips[1]).toMatchObject({ transitionIn: 'slide', transitionInMs: 800 });
  });

  it('caps a transition at half of the shorter neighbouring clip and ignores one on the first clip', () => {
    const a = withTransition(clip({ startMs: 0, outPointMs: 1_000 }), 'slide', 5_000);
    const b = withTransition(clip({ startMs: 1_000, outPointMs: 9_000 }), 'slide', 5_000);
    const plan = planExport([track([a, b])]);

    expect(plan.transitions).toHaveLength(1);
    expect(plan.transitions[0]).toMatchObject({ durationMs: 500, atMs: 1_000 });
    expect(plan.clips[0].transitionIn).toBe('');
  });
});
