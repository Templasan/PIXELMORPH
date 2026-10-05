import type { ExportPlan, PlannedClip } from '../../src/modules/video-editor/exportPlan';
import { gifSize, planGifFrames } from '../../src/modules/video-editor/gifPlan';

const video = (over: Partial<PlannedClip> = {}): PlannedClip => ({
  kind: 'video',
  sourceUri: 'file:///a.mp4',
  inMs: 0,
  outMs: 1000,
  stillTimeMs: 0,
  holdMs: 0,
  speed: 1,
  volume: 1,
  rotation: 0,
  transitionIn: '',
  transitionInMs: 0,
  transitionFrom: null,
  outputMs: 1000,
  startMs: 0,
  ...over,
});
const plan = (clips: PlannedClip[]): ExportPlan => ({
  clips,
  transitions: [],
  audio: [],
  durationMs: 0,
});

describe('planGifFrames (RF-061)', () => {
  it('samples a clip at the chosen frame rate with matching delays', () => {
    const { frames, truncated } = planGifFrames(plan([video({ outMs: 1000 })]), 10);
    expect(frames).toHaveLength(10);
    expect(frames[0]).toMatchObject({ sourceTimeMs: 0, delayMs: 100 });
    expect(frames[9].sourceTimeMs).toBeCloseTo(900);
    expect(truncated).toBe(false);
  });

  it('honours trim and speed: a 2x clip needs half the frames and steps twice as far', () => {
    const { frames } = planGifFrames(plan([video({ inMs: 2000, outMs: 4000, speed: 2 })]), 10);
    expect(frames).toHaveLength(10);
    expect(frames[0].sourceTimeMs).toBe(2000);
    expect(frames[1].sourceTimeMs).toBeCloseTo(2200);
  });

  it('holds a freeze frame on one source instant', () => {
    const still = video({ kind: 'still', holdMs: 500, stillTimeMs: 1234, inMs: 0, outMs: 0 });
    const { frames } = planGifFrames(plan([still]), 10);
    expect(frames).toHaveLength(5);
    expect(new Set(frames.map((f) => f.sourceTimeMs))).toEqual(new Set([1234]));
  });

  it('cuts a long timeline at the maximum duration and says so', () => {
    const { frames, truncated } = planGifFrames(plan([video({ outMs: 60_000 })]), 10, 5000);
    expect(frames).toHaveLength(50);
    expect(truncated).toBe(true);
  });

  it('is empty for an empty plan', () => {
    expect(planGifFrames(plan([]), 10)).toEqual({ frames: [], truncated: false });
  });
});

describe('gifSize', () => {
  it('keeps the aspect ratio and never upscales', () => {
    expect(gifSize(1080, 1920, 360)).toEqual({ width: 360, height: 640 });
    expect(gifSize(200, 100, 360)).toEqual({ width: 200, height: 100 });
  });
});
