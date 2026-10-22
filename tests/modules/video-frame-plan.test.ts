import { createClip, type Clip, type Track } from '../../src/modules/video-editor/domain/Track';
import { frameAt, planSequence } from '../../src/modules/video-editor/domain/framePlan';
import { planExport } from '../../src/modules/video-editor/domain/exportPlan';
import { setClipSpeed } from '../../src/modules/video-editor/domain/timeline';

const clip = (over: Partial<Clip> & { startMs: number; id?: string }): Clip => ({
  ...createClip({
    name: 'c',
    sourceUri: 'file:///a.mp4',
    color: '#fff',
    startMs: 0,
    sourceDurationMs: 10_000,
  }),
  outPointMs: 2_000,
  ...over,
});
const track = (clips: Clip[], over: Partial<Track> = {}): Track => ({
  id: 'v1',
  name: 'V1',
  kind: 'video',
  visible: true,
  locked: false,
  clips,
  ...over,
});
const imageTrack = (clips: Clip[]) => track(clips, { id: 'img', kind: 'image' });

describe('frame plan: gaps are real, in preview and export alike', () => {
  const a = clip({ id: 'a', startMs: 0 });
  const b = clip({ id: 'b', startMs: 3_000 });
  const tracks = [track([a, b])];

  it('plans a black gap piece between clips', () => {
    const plan = planSequence(tracks);
    expect(plan.clips.map((c) => [c.kind, c.startMs, c.outputMs])).toEqual([
      ['video', 0, 2_000],
      ['gap', 2_000, 1_000],
      ['video', 3_000, 2_000],
    ]);
    expect(plan.durationMs).toBe(5_000);
  });

  it('counts a gap at the very start but not time after the last clip', () => {
    const plan = planSequence([track([clip({ id: 'x', startMs: 1_000 })]), track([], { id: 'e' })]);
    expect(plan.clips.map((c) => c.kind)).toEqual(['gap', 'video']);
    expect(plan.durationMs).toBe(3_000);
  });

  it('answers the same for the preview and the export', () => {
    const plan = planSequence(tracks);
    expect(planExport(tracks).clips).toEqual(plan.clips);
    expect(frameAt(plan, 2_500)?.piece.kind).toBe('gap');
    expect(frameAt(plan, 3_500)).toMatchObject({ sourceTimeMs: 500 });
    expect(frameAt(plan, 5_000)?.piece.clipId).toBe('b'); // the end holds the last frame
    expect(frameAt(plan, 5_001)).toBeNull();
    expect(frameAt(planSequence([]), 0)).toBeNull();
  });

  it('never puts a transition across a gap', () => {
    const t = { ...b, transitionIn: { type: 'fade' as const, durationMs: 500 } };
    expect(planSequence([track([a, t])]).transitions).toEqual([]);
  });
});

describe('frame plan: speed, trim and several tracks', () => {
  it('maps playhead time to source time through speed and trim', () => {
    const c = clip({ id: 'c', startMs: 0, inPointMs: 1_000, outPointMs: 5_000, speed: 2 });
    const plan = planSequence([track([c])]);
    expect(plan.durationMs).toBe(2_000);
    expect(frameAt(plan, 500)?.sourceTimeMs).toBe(2_000);
    expect(frameAt(plan, 2_000)?.sourceTimeMs).toBe(5_000);
  });

  it('puts the image track on top and splits the video around it', () => {
    const v = clip({ id: 'v', startMs: 0, outPointMs: 5_000 });
    const img = clip({ id: 'i', startMs: 1_000, outPointMs: 2_000, sourceUri: 'file:///p.jpg' });
    const plan = planSequence([track([v]), imageTrack([img])]);
    expect(plan.clips.map((c) => [c.kind, c.startMs, c.outputMs])).toEqual([
      ['video', 0, 1_000],
      ['image', 1_000, 2_000],
      ['video', 3_000, 2_000],
    ]);
    expect(plan.clips[2]).toMatchObject({ inMs: 3_000, outMs: 5_000 });
    expect(plan.durationMs).toBe(5_000);
  });

  it('holds an image for its speed-adjusted length', () => {
    const img = { ...clip({ id: 'i', startMs: 0, outPointMs: 400 }), speed: 2 };
    const [piece] = planExport([imageTrack([img])]).clips;
    expect(piece).toMatchObject({ kind: 'image', holdMs: 200, outputMs: 200 });
  });

  it('exports a photo-only project, with transitions between photos', () => {
    const p1 = clip({ id: 'p1', startMs: 0, outPointMs: 1_000, sourceUri: 'file:///1.jpg' });
    const p2 = {
      ...clip({ id: 'p2', startMs: 1_000, outPointMs: 1_000, sourceUri: 'file:///2.jpg' }),
      transitionIn: { type: 'slide' as const, durationMs: 2_000 },
    };
    const plan = planExport([imageTrack([p1, p2])]);
    expect(plan.clips.map((c) => c.kind)).toEqual(['image', 'image']);
    expect(plan.durationMs).toBe(2_000);
    expect(plan.clips[1]).toMatchObject({ transitionIn: 'slide', transitionInMs: 500 });
    expect(plan.clips[1].transitionFrom).toMatchObject({ sourceUri: 'file:///1.jpg', image: true });
  });

  it('reports the transition progress and clamps it to half of the shorter piece', () => {
    const a = clip({ id: 'a', startMs: 0, outPointMs: 1_000 });
    const b = {
      ...clip({ id: 'b', startMs: 1_000, outPointMs: 8_000 }),
      transitionIn: { type: 'wipe' as const, durationMs: 5_000 },
    };
    const plan = planSequence([track([a, b])]);
    expect(plan.transitions[0]).toMatchObject({ atMs: 1_000, durationMs: 500 });
    const mid = frameAt(plan, 1_250)?.transition;
    expect(mid).toMatchObject({ type: 'wipe', progress: 0.5 });
    expect(frameAt(plan, 1_600)?.transition).toBeNull();
  });
});

describe('setClipSpeed ripples the following clips', () => {
  const a = clip({ id: 'a', startMs: 0 });
  const b = clip({ id: 'b', startMs: 2_000 });
  const c = clip({ id: 'c', startMs: 5_000 }); // 1 s gap after b

  it('pushes later clips when slowing down and keeps their gaps', () => {
    const [t] = setClipSpeed([track([a, b, c])], 'v1', 'a', 0.5);
    expect(t.clips.map((x) => x.startMs)).toEqual([0, 4_000, 7_000]);
  });

  it('pulls them back when speeding up, never overlapping', () => {
    const [t] = setClipSpeed([track([a, b, c])], 'v1', 'a', 2);
    expect(t.clips.map((x) => x.startMs)).toEqual([0, 1_000, 4_000]);
  });

  it('leaves other tracks alone', () => {
    const other = track([clip({ id: 'o', startMs: 2_000 })], { id: 'v2' });
    const [, o] = setClipSpeed([track([a, b]), other], 'v1', 'a', 0.5);
    expect(o.clips[0].startMs).toBe(2_000);
  });
});
