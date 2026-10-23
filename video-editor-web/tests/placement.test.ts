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
  it('uses the first track of the kind with room at the playhead', () => {
    const tracks = [text('t1', [0]), text('t2', [])];
    expect(placeAtPlayhead(tracks, 'text', 4000, 3000).trackId).toBe('t1');
    expect(placeAtPlayhead(tracks, 'text', 1000, 3000).trackId).toBe('t2');
  });

  it('adds a new track right after the last one of the kind when all are busy', () => {
    const v: Track = { ...text('v1', []), kind: 'video' };
    const tracks = [v, text('t1', [0]), { ...text('a1', []), kind: 'audio' as const }];
    const out = placeAtPlayhead(tracks, 'text', 1000, 3000);
    expect(out.tracks.map((t) => t.id)).toEqual(['v1', 't1', out.trackId, 'a1']);
    expect(out.tracks[2].name).toBe('TXT 2');
  });
});
