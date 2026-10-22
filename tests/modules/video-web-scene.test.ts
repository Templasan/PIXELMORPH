import { createClip, type Clip, type Track } from '../../src/modules/video-editor/domain/Track';
import {
  buildEditorScene,
  buildSpikeScene,
  spanGainAt,
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

describe('buildEditorScene', () => {
  const tracks = [track([a, b])];

  it('is the main sequence only, 1080p by default', () => {
    const s = buildEditorScene(tracks);
    expect([s.width, s.height]).toEqual([1920, 1080]);
    expect(s.pips).toEqual([]);
    expect(s.texts).toEqual([]);
    expect(s.stickers).toEqual([]);
    expect(s.durationMs).toBe(s.main.durationMs);
    const ops = drawListAt(s, 500);
    expect(ops.map((o) => o.kind)).toEqual(['clear', 'video']);
  });

  it('draws black in a gap and honours the size option', () => {
    const s = buildEditorScene(tracks, { width: 1280, height: 720 });
    expect([s.width, s.height]).toEqual([1280, 720]);
    expect(drawListAt(s, 2_500).map((o) => o.kind)).toEqual(['clear']);
  });

  it('maps every source uri, including the outgoing side of a transition', () => {
    const butted = [track([a, { ...b, startMs: 2_000 }])];
    const s = buildEditorScene(butted, { mapUri: (u) => u.replace('.mp4', '.proxy.mp4') });
    const ops = drawListAt(s, 2_100);
    expect(video(ops, 'main')?.uri).toBe('file:///b.proxy.mp4');
    expect(video(ops, 'out')?.uri).toBe('file:///a.proxy.mp4');
  });
});

describe('scene audio', () => {
  it('each video piece brings its own sound at its place, muted clips and gaps none', () => {
    const muted = clip({ id: 'm', startMs: 6_000, volume: 0 });
    const s = buildEditorScene([track([a, b, muted])]);
    expect(s.audio.map((x) => [x.uri, x.startMs, x.outputMs, x.inMs, x.speed])).toEqual([
      ['file:///a.mp4', 0, 2_000, 0, 1],
      ['file:///b.mp4', 3_000, 2_000, 0, 1],
    ]);
  });

  it('a 2x clip plays its sound twice as fast over half the time', () => {
    const fast = clip({ id: 'f', startMs: 0, speed: 2 });
    const [span] = buildEditorScene([track([fast])]).audio;
    expect([span.outputMs, span.speed]).toEqual([1_000, 2]);
  });

  it('audio-track clips follow with their volume and fades', () => {
    const music: Track = {
      ...track([
        clip({
          id: 'mu',
          startMs: 0,
          sourceUri: 'file:///m.mp3',
          volume: 50,
          fadeInMs: 500,
          fadeOutMs: 500,
        }),
      ]),
      id: 'a1',
      kind: 'audio',
    };
    const span = buildEditorScene([track([a]), music]).audio.find(
      (x) => x.uri === 'file:///m.mp3'
    )!;
    expect([span.volume, span.fadeInMs, span.fadeOutMs]).toEqual([0.5, 500, 500]);
    expect(spanGainAt(span, 250)).toBeCloseTo(0.25);
    expect(spanGainAt(span, 1_000)).toBeCloseTo(0.5);
    expect(spanGainAt(span, 1_750)).toBeCloseTo(0.25);
    expect(spanGainAt(span, 2_500)).toBe(0);
  });
});

describe('pictures on the timeline', () => {
  const photo = clip({ id: 'p', startMs: 0, sourceUri: 'file:///p.jpg' });
  const images: Track = { ...track([photo]), id: 'img', kind: 'image' };

  it('an image piece draws the picture, not a video frame', () => {
    const ops = drawListAt(buildEditorScene([images]), 500);
    expect(ops.map((o) => o.kind)).toEqual(['clear', 'image']);
    expect(ops[1]).toMatchObject({ uri: 'file:///p.jpg', layer: 'main' });
  });

  it('a transition out of a picture lays the picture over the incoming clip', () => {
    const next = clip({
      id: 'n',
      startMs: 2_000,
      sourceUri: 'file:///n.mp4',
      transitionIn: { type: 'fade', durationMs: 500 },
    });
    const s = buildEditorScene([track([next]), { ...images, id: 'img2' }]);
    const ops = drawListAt(s, 2_100);
    expect(ops.find((o) => o.kind === 'image')).toMatchObject({
      layer: 'out',
      uri: 'file:///p.jpg',
    });
    expect(ops.find((o) => o.kind === 'video')).toMatchObject({
      layer: 'main',
      uri: 'file:///n.mp4',
    });
  });
});
