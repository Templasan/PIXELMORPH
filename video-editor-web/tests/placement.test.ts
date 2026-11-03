import { placeAtPlayhead } from '../src/application/placement';
import { createClip, type Track } from '../src/domain/Track';

const text = (id: string, starts: number[]): Track => ({
  id,
  name: id,
  kind: 'text',
  visible: true,
  locked: false,
  clips: starts.map((s) => createClip({ name: 't', sourceUri: '', color: '', startMs: s, sourceDurationMs: 3000 })),
});

describe('placeAtPlayhead', () => {
  it('uses the highest picture track with room, whatever it already holds', () => {
    const tracks = [text('t1', [0]), text('t2', [])];
    expect(placeAtPlayhead(tracks, 'image', 1000, 3000).trackId).toBe('t2');
    expect(placeAtPlayhead([text('t1', []), text('t2', [0])], 'text', 4000, 3000).trackId).toBe('t2');
  });

  it('never lands under a track that plays over that stretch', () => {
    const out = placeAtPlayhead([text('t1', []), text('t2', [0])], 'text', 1000, 3000);
    expect(out.trackId).not.toBe('t1');
    expect(out.tracks.at(-1)!.id).toBe(out.trackId);
  });

  it('adds a new track on top of the pictures when all are busy, below nothing but sound', () => {
    const v: Track = { ...text('v1', [0]), kind: 'video' };
    const tracks = [v, text('t1', [0]), { ...text('a1', []), kind: 'audio' as const }];
    const out = placeAtPlayhead(tracks, 'image', 1000, 3000);
    expect(out.tracks.map((t) => t.id)).toEqual(['v1', 't1', out.trackId, 'a1']);
    expect(out.tracks[2].name).toBe('V3');
  });

  it('keeps sound on sound tracks', () => {
    const tracks = [text('t1', []), { ...text('a1', [0]), kind: 'audio' as const }];
    const out = placeAtPlayhead(tracks, 'audio', 1000, 3000);
    expect(out.tracks.map((t) => t.kind)).toEqual(['text', 'audio', 'audio']);
    expect(placeAtPlayhead(tracks, 'audio', 4000, 3000).trackId).toBe('a1');
  });
});
