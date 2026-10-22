import { createClip, type Clip, type Track } from '../../src/modules/video-editor/domain/Track';
import {
  buildSpikeScene,
  drawListAt,
  sampleKeyframes,
  type DrawOp,
} from '../../src/modules/video-editor/domain/webScene';

const clip = (over: Partial<Clip> & { startMs: number; id: string }): Clip => ({
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
const track = (clips: Clip[]): Track => ({
  id: 'v1',
  name: 'V1',
  kind: 'video',
  visible: true,
  locked: false,
  clips,
});
const video = (ops: DrawOp[], layer: string) =>
  ops.find((o): o is Extract<DrawOp, { kind: 'video' }> => o.kind === 'video' && o.layer === layer);

const a = clip({ id: 'a', startMs: 0 });
const b = clip({
  id: 'b',
  startMs: 3_000,
  sourceUri: 'file:///b.mp4',
  transitionIn: { type: 'slide', durationMs: 500 },
});
const opts = { stickerDataUri: 'data:image/png;base64,AA==' };
const scene = buildSpikeScene([track([a, b])], opts);
// Same clips butted together: the transition has a real outgoing frame (none plays across a gap).
const joined = buildSpikeScene([track([a, { ...b, startMs: 2_000 }])], opts);

describe('web scene: one draw list for preview and export', () => {
  it('a gap draws black and no main video', () => {
    const ops = drawListAt(scene, 2_500);
    expect(ops[0]).toEqual({ kind: 'clear', color: '#000000' });
    expect(video(ops, 'main')).toBeUndefined();
  });

  it('PiP layers reuse the project sources; the second is at 70% opacity and 30% size', () => {
    const ops = drawListAt(scene, 1_000);
    expect(video(ops, 'pip1')?.uri).toBe('file:///a.mp4');
    expect(video(ops, 'pip2')?.uri).toBe('file:///b.mp4');
    expect(video(ops, 'pip1')?.opacity).toBe(1);
    expect(video(ops, 'pip2')?.opacity).toBe(0.7);
    expect(video(ops, 'pip1')?.rect.w).toBe(576);
    expect(video(ops, 'pip1')?.sourceTimeMs).toBe(1_000);
  });

  it('the text slides in over 0.6 s, then scales 1.0 to 1.2 over its life', () => {
    const text = (t: number) => drawListAt(scene, t).find((o) => o.kind === 'text');
    const at0 = text(0);
    const mid = text(300);
    const end = text(scene.durationMs);
    if (at0?.kind !== 'text' || mid?.kind !== 'text' || end?.kind !== 'text') throw new Error('x');
    expect(at0.x).toBe(-700);
    expect(mid.x).toBeGreaterThan(-700);
    expect(mid.x).toBeLessThan(80);
    expect(text(600) && (text(600) as { x: number }).x).toBe(80);
    expect(at0.scale).toBe(1);
    expect(end.scale).toBeCloseTo(1.2);
  });

  it('the sticker interpolates position and rotation', () => {
    const sticker = (t: number) => drawListAt(scene, t).find((o) => o.kind === 'sticker');
    const s0 = sticker(0);
    const half = sticker(scene.durationMs / 2);
    if (s0?.kind !== 'sticker' || half?.kind !== 'sticker') throw new Error('x');
    expect(s0.rotationDeg).toBe(0);
    expect(half.rotationDeg).toBeCloseTo(180);
    expect(half.x).toBeCloseTo(960);
  });

  it('a transition junction draws the frozen outgoing frame over the incoming clip', () => {
    const ops = drawListAt(joined, 2_250); // halfway through the 500 ms slide
    const out = video(ops, 'out');
    expect(out?.uri).toBe('file:///a.mp4');
    expect(out?.translateX).toBeCloseTo(-960); // slide leaves left, progress 0.5 of 1920
    expect(video(ops, 'main')?.uri).toBe('file:///b.mp4');
    expect(video(drawListAt(joined, 2_600), 'out')).toBeUndefined();
  });

  it('is deterministic: the same time always gives the same list, in any order', () => {
    const first = JSON.stringify(drawListAt(scene, 3_100));
    drawListAt(scene, 100);
    drawListAt(scene, 4_900);
    expect(JSON.stringify(drawListAt(scene, 3_100))).toBe(first);
    expect(JSON.parse(JSON.stringify(scene))).toEqual(scene);
  });

  it('keyframes clamp outside their range', () => {
    const keys = [
      { tMs: 100, v: 1 },
      { tMs: 200, v: 3 },
    ];
    expect(sampleKeyframes(keys, 0)).toBe(1);
    expect(sampleKeyframes(keys, 150)).toBe(2);
    expect(sampleKeyframes(keys, 999)).toBe(3);
  });
});
