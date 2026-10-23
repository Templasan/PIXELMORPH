import {
  buildComposition,
  mediaAround,
  opsAt,
  type MediaOp,
} from '../src/domain/composition';
import { clipEndMs, createClip, type Clip, type Track } from '../src/domain/Track';
import { DEFAULT_TEXT } from '../src/domain/textCaption';

const track = (id: string, kind: Track['kind'], clips: Clip[]): Track => ({
  id,
  name: id,
  kind,
  visible: true,
  locked: false,
  clips,
});

const clip = (name: string, startMs: number, durMs: number, extra: Partial<Clip> = {}): Clip => ({
  ...createClip({ name, sourceUri: `${name}.mp4`, color: '#fff', startMs, sourceDurationMs: 10_000 }),
  outPointMs: durMs,
  ...extra,
});

const media = (ops: ReturnType<typeof opsAt>) =>
  ops.filter((o): o is MediaOp => o.kind === 'video' || o.kind === 'image');

describe('composition', () => {
  it('draws every visible media track as a layer, later tracks above', () => {
    const a = clip('a', 0, 5000);
    const b = clip('b', 1000, 2000);
    const c = buildComposition([track('v1', 'video', [a]), track('v2', 'video', [b])]);
    expect(media(opsAt(c, 1500)).map((o) => o.clipId)).toEqual([a.id, b.id]);
    expect(media(opsAt(c, 4000)).map((o) => o.clipId)).toEqual([a.id]);
  });

  it('puts a picture over the video instead of replacing it', () => {
    const v = clip('v', 0, 4000);
    const p = clip('p', 1000, 1000, { sourceUri: 'p.png', pipPosition: { x: 0.5, y: 0.5 }, pipSize: { width: 0.25, height: 0.25 } });
    const c = buildComposition([track('v1', 'video', [v]), track('img', 'image', [p])], {
      width: 1000,
      height: 500,
    });
    const ops = media(opsAt(c, 1500));
    expect(ops.map((o) => o.kind)).toEqual(['video', 'image']);
    expect(ops[1].rect).toEqual({ x: 500, y: 250, w: 250, h: 125 });
  });

  it('is end-exclusive and ends with the last picture, cutting longer sound', () => {
    const a = clip('a', 0, 1000);
    const p = clip('p', 500, 2000, { sourceUri: 'p.png' });
    const m = clip('m', 0, 9000, { sourceUri: 'm.m4a' });
    const c = buildComposition([
      track('v1', 'video', [a]),
      track('img', 'image', [p]),
      track('a1', 'audio', [m]),
    ]);
    expect(c.durationMs).toBe(2500);
    expect(media(opsAt(c, 999))).toHaveLength(2);
    expect(media(opsAt(c, 1000))).toHaveLength(1);
    expect(opsAt(c, 2500)).toEqual([{ kind: 'clear', color: '#000000' }]);
    const soundOnly = buildComposition([track('a1', 'audio', [m])]);
    expect(soundOnly.durationMs).toBe(9000);
  });

  it('never shows a frame past the out point inside the clip', () => {
    const a = clip('a', 0, 1000, { inPointMs: 2000, outPointMs: 3000 });
    const c = buildComposition([track('v1', 'video', [a])]);
    expect(media(opsAt(c, 999.9))[0].sourceTimeMs).toBeLessThan(3000);
    expect(media(opsAt(c, 0))[0].sourceTimeMs).toBe(2000);
  });

  it('plays a transition only between adjacent clips, with the outgoing clip still running', () => {
    const a = clip('a', 0, 2000);
    const b = clip('b', 2000, 2000, { transitionIn: { type: 'fade', durationMs: 500 } });
    const c = buildComposition([track('v1', 'video', [a, b])]);
    const mid = media(opsAt(c, 2250));
    expect(mid.map((o) => [o.clipId, o.key.endsWith(':out')])).toEqual([
      [b.id, false],
      [a.id, true],
    ]);
    expect(mid[1].sourceTimeMs).toBe(2250); // a's source keeps running past its out point
    expect(mid[1].opacity).toBeCloseTo(0.5);
    expect(media(opsAt(c, 2600))).toHaveLength(1);

    const gap = buildComposition([
      track('v1', 'video', [a, { ...b, startMs: 2100 }]),
    ]);
    expect(media(opsAt(gap, 2200))).toHaveLength(1);
  });

  it('draws texts above every media layer', () => {
    const v = clip('v', 0, 2000);
    const t = { ...clip('t', 0, 2000), text: { ...DEFAULT_TEXT, content: 'Oi' } };
    const c = buildComposition([track('txt', 'text', [t]), track('v1', 'video', [v])]);
    const ops = opsAt(c, 500);
    expect(ops[ops.length - 1].kind).toBe('caption');
  });

  it('mixes the sound of every video clip and audio clip, overlaps included', () => {
    const a = clip('a', 0, 2000);
    const b = clip('b', 1000, 2000);
    const m1 = clip('m1', 0, 3000, { sourceUri: 'm1.m4a' });
    const m2 = clip('m2', 500, 1000, { sourceUri: 'm2.m4a', volume: 50 });
    const c = buildComposition([
      track('v1', 'video', [a]),
      track('v2', 'video', [b]),
      track('a1', 'audio', [m1, m2]),
    ]);
    expect(c.audio.map((s) => s.uri).sort()).toEqual(['a.mp4', 'b.mp4', 'm1.m4a', 'm2.m4a']);
    expect(c.audio.find((s) => s.uri === 'm2.m4a')!.volume).toBe(0.5);
  });

  it('prepares clips that start soon', () => {
    const a = clip('a', 0, 1000);
    const b = clip('b', 1500, 1000);
    const c = buildComposition([track('v1', 'video', [a]), track('v2', 'video', [b])]);
    expect(mediaAround(c, 800, 1000).map((o) => o.clipId)).toEqual([a.id, b.id]);
    expect(mediaAround(c, 0, 1000).map((o) => o.clipId)).toEqual([a.id]);
  });

  it('holds its rules on random timelines', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let run = 0; run < 200; run += 1) {
      const tracks: Track[] = [];
      for (let k = 0; k < 1 + Math.floor(rnd() * 3); k += 1) {
        const clips: Clip[] = [];
        let at = Math.floor(rnd() * 500);
        for (let n = 0; n < 1 + Math.floor(rnd() * 4); n += 1) {
          const dur = 300 + Math.floor(rnd() * 2000);
          const inMs = Math.floor(rnd() * 3000);
          const speed = [0.5, 1, 2][Math.floor(rnd() * 3)];
          clips.push(
            clip(`k${k}n${n}`, at, dur, {
              inPointMs: inMs,
              outPointMs: inMs + dur * speed,
              speed,
              transitionIn: rnd() < 0.4 ? { type: 'slide', durationMs: 400 } : undefined,
            })
          );
          at += dur + (rnd() < 0.5 ? 0 : Math.floor(rnd() * 400));
        }
        tracks.push(track(`v${k}`, 'video', clips));
      }
      const c = buildComposition(tracks);
      const byId = new Map(tracks.flatMap((t) => t.clips).map((cl) => [cl.id, cl]));
      const layerOf = new Map(tracks.flatMap((t, i) => t.clips.map((cl) => [cl.id, i])));
      for (let s = 0; s < 40; s += 1) {
        const t = rnd() * (c.durationMs + 200);
        const ops = media(opsAt(c, t));
        let lastLayer = -1;
        for (const op of ops) {
          const cl = byId.get(op.clipId)!;
          const layer = layerOf.get(op.clipId)!;
          expect(layer).toBeGreaterThanOrEqual(lastLayer); // bottom to top
          lastLayer = layer;
          if (op.key.endsWith(':in')) {
            expect(t).toBeGreaterThanOrEqual(cl.startMs);
            expect(t).toBeLessThan(clipEndMs(cl));
            expect(op.sourceTimeMs).toBeGreaterThanOrEqual(cl.inPointMs);
            expect(op.sourceTimeMs).toBeLessThan(cl.outPointMs);
          }
        }
        if (t >= c.durationMs) expect(ops).toHaveLength(0);
      }
    }
  });
});
