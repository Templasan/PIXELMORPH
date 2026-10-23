import { buildComposition, opsAt, type MediaOp } from '../src/domain/composition';
import { clipDurationMs, clipEndMs, createClip, type Clip, type Track } from '../src/domain/Track';
import {
  MIN_CLIP_DURATION_MS,
  moveClip,
  removeClip,
  rippleDelete,
  rippleTrim,
  setClipSpeed,
  splitClipAtMs,
  trimClipIn,
  trimClipOut,
} from '../src/domain/timeline';

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

function randomTracks(): Track[] {
  return [0, 1].map((k) => {
    let at = 0;
    const clips: Clip[] = [];
    for (let n = 0; n < 3; n += 1) {
      const src = 4000 + Math.floor(rnd() * 6000);
      const c = createClip({ name: `c${k}${n}`, sourceUri: `s${k}${n}.mp4`, color: '#fff', startMs: at, sourceDurationMs: src });
      const speed = pick([0.5, 1, 1, 2]);
      clips.push({ ...c, speed });
      at = clipEndMs({ ...c, speed }) + pick([0, 0, 300]);
    }
    return { id: `t${k}`, name: `t${k}`, kind: 'video', visible: true, locked: false, clips };
  });
}

function checkInvariants(tracks: Track[]) {
  for (const t of tracks) {
    const sorted = [...t.clips].sort((a, b) => a.startMs - b.startMs);
    sorted.forEach((c, i) => {
      expect(c.startMs).toBeGreaterThanOrEqual(0);
      expect(c.inPointMs).toBeGreaterThanOrEqual(0);
      expect(c.outPointMs).toBeLessThanOrEqual(c.sourceDurationMs + 1e-6);
      expect(c.outPointMs).toBeGreaterThan(c.inPointMs);
      expect(clipDurationMs(c)).toBeGreaterThanOrEqual(MIN_CLIP_DURATION_MS - 1e-6);
      if (i > 0) expect(c.startMs).toBeGreaterThanOrEqual(clipEndMs(sorted[i - 1]) - 1e-6);
    });
  }
}

const sourceAt = (tracks: Track[], t: number) =>
  opsAt(buildComposition(tracks), t)
    .filter((o): o is MediaOp => o.kind === 'video')
    .map((o) => `${o.uri}@${o.sourceTimeMs.toFixed(3)}`);

describe('timeline edits on random timelines', () => {
  it('never overlap, never leave the source, never get shorter than the minimum', () => {
    for (let run = 0; run < 300; run += 1) {
      let tracks = randomTracks();
      for (let step = 0; step < 12; step += 1) {
        const track = pick(tracks);
        if (!track.clips.length) continue;
        const c = pick(track.clips);
        const op = pick(['move', 'in', 'out', 'split', 'speed', 'remove', 'rin', 'rout', 'rdel'] as const);
        if (op === 'move') tracks = moveClip(tracks, track.id, c.id, c.startMs + (rnd() - 0.5) * 4000);
        if (op === 'in') tracks = trimClipIn(tracks, track.id, c.id, c.inPointMs + (rnd() - 0.5) * 3000);
        if (op === 'out') tracks = trimClipOut(tracks, track.id, c.id, c.outPointMs + (rnd() - 0.5) * 3000);
        if (op === 'speed') tracks = setClipSpeed(tracks, track.id, c.id, pick([0.25, 0.5, 1, 2, 4]));
        if (op === 'remove' && track.clips.length > 1) tracks = removeClip(tracks, track.id, c.id);
        if (op === 'rin') tracks = rippleTrim(tracks, track.id, c.id, 'in', c.inPointMs + (rnd() - 0.5) * 3000);
        if (op === 'rout') tracks = rippleTrim(tracks, track.id, c.id, 'out', c.outPointMs + (rnd() - 0.5) * 3000);
        if (op === 'rdel' && track.clips.length > 1) tracks = rippleDelete(tracks, track.id, c.id);
        if (op === 'split') {
          const at = c.startMs + rnd() * clipDurationMs(c);
          const before = sourceAt(tracks, at + 50);
          const end = Math.max(...tracks.flatMap((t) => t.clips.map(clipEndMs)));
          tracks = splitClipAtMs(tracks, track.id, c.id, at);
          // Splitting changes nothing on screen and nothing about the length.
          expect(sourceAt(tracks, at + 50)).toEqual(before);
          expect(Math.max(...tracks.flatMap((t) => t.clips.map(clipEndMs)))).toBeCloseTo(end, 6);
        }
        try { checkInvariants(tracks); } catch (e) { throw new Error(`after ${op}: ${(e as Error).message}`); }
      }
    }
  });
});

describe('ripple edits', () => {
  const clip = (name: string, startMs: number, len: number) => ({
    ...createClip({ name, sourceUri: `${name}.mp4`, color: '', startMs, sourceDurationMs: 10_000 }),
    outPointMs: len,
  });
  const t = (): Track[] => [
    { id: 'v', name: 'v', kind: 'video', visible: true, locked: false, clips: [clip('a', 0, 2000), clip('b', 2000, 2000), clip('c', 5000, 1000)] },
  ];
  const starts = (tracks: Track[]) => tracks[0].clips.map((c) => [c.name, c.startMs, clipEndMs(c)]);

  it('a longer end pushes the next clips, keeping the gap between them', () => {
    const tracks = t();
    const [a] = tracks[0].clips;
    expect(starts(rippleTrim(tracks, 'v', a.id, 'out', 3000))).toEqual([['a', 0, 3000], ['b', 3000, 5000], ['c', 6000, 7000]]);
  });

  it('a trimmed start keeps the clip in place and pulls the rest', () => {
    const tracks = t();
    const b = tracks[0].clips[1];
    expect(starts(rippleTrim(tracks, 'v', b.id, 'in', 500))).toEqual([['a', 0, 2000], ['b', 2000, 3500], ['c', 4500, 5500]]);
  });

  it('delete closes the hole', () => {
    const tracks = t();
    const [a] = tracks[0].clips;
    expect(starts(rippleDelete(tracks, 'v', a.id))).toEqual([['b', 0, 2000], ['c', 3000, 4000]]);
  });
});
