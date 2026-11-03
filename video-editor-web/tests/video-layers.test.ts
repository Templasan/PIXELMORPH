import { clipMedia, createClip, type Clip, type Track } from '../src/domain/Track';
import { addPictureTrack, migrateTracks, moveClipToTrack, shiftTrack } from '../src/domain/timeline';
import { buildComposition, liveLayerCap, liveLayerKeys, opsAt, type CompositionOp, type MediaOp } from '../src/domain/composition';
import { displayOrder } from '../src/ui/trackOrder';

const clip = (id: string, startMs: number, extra: Partial<Clip> = {}): Clip => ({
  ...createClip({ name: id, sourceUri: id, color: '', startMs, sourceDurationMs: 1000 }),
  id,
  ...extra,
});
const track = (id: string, kind: Track['kind'], clips: Clip[] = [], locked = false): Track => ({
  id,
  name: id,
  kind,
  visible: true,
  locked,
  clips,
});
const ids = (tracks: Track[]) => tracks.map((t) => t.id);

describe('moveClipToTrack', () => {
  it('moves to the nearest free spot of the other track and keeps what the clip is', () => {
    const tracks = [track('img', 'image', [clip('a', 0)]), track('v2', 'video', [clip('b', 500)])];
    const out = moveClipToTrack(tracks, 'img', 'v2', 'a', 600);
    expect(out[0].clips).toHaveLength(0);
    const moved = out[1].clips.find((c) => c.id === 'a')!;
    expect(moved.startMs).toBe(1500);
    expect(clipMedia(out[1], moved)).toBe('image');
  });

  it('never mixes sound with pictures, and respects a locked track', () => {
    const tracks = [track('v1', 'video', [clip('a', 0)]), track('a1', 'audio'), track('v2', 'video', [], true)];
    expect(moveClipToTrack(tracks, 'v1', 'a1', 'a', 0)).toBe(tracks);
    expect(moveClipToTrack(tracks, 'v1', 'v2', 'a', 0)).toBe(tracks);
  });

  it('leaves the transition behind', () => {
    const tracks = [track('v1', 'video', [clip('a', 0, { transitionIn: { type: 'fade', durationMs: 100 } })]), track('v2', 'video')];
    expect(moveClipToTrack(tracks, 'v1', 'v2', 'a', 0)[1].clips[0].transitionIn).toBeUndefined();
  });
});

describe('the stack', () => {
  it('a new track goes on top of the pictures, below nothing but sound', () => {
    const out = addPictureTrack([track('v1', 'video'), track('a1', 'audio')], 'new');
    expect(ids(out)).toEqual(['v1', 'new', 'a1']);
    expect(out[1].name).toBe('V2');
  });

  it('a track moves among its class only and stops at the ends', () => {
    const tracks = [track('v1', 'video'), track('a1', 'audio'), track('v2', 'video'), track('v3', 'video')];
    expect(ids(shiftTrack(tracks, 'v1', 1))).toEqual(['v2', 'a1', 'v1', 'v3']);
    expect(ids(shiftTrack(tracks, 'v3', -9))).toEqual(['v3', 'a1', 'v1', 'v2']);
    expect(shiftTrack(tracks, 'v3', 1)).toBe(tracks);
    expect(shiftTrack(tracks, 'a1', 1)).toBe(tracks);
  });

  it('a sound track goes up the screen toward the start of the list', () => {
    const tracks = [track('a1', 'audio'), track('a2', 'audio')];
    expect(ids(shiftTrack(tracks, 'a2', 1))).toEqual(['a2', 'a1']);
    expect(ids(shiftTrack(tracks, 'a1', -1))).toEqual(['a2', 'a1']);
  });

  it('rows run from the top layer down, sound last', () => {
    expect(ids(displayOrder([track('v1', 'video'), track('a1', 'audio'), track('v2', 'video')]))).toEqual(['v2', 'v1', 'a1']);
  });
});

describe('projects saved with IMG and TXT tracks', () => {
  it('become plain tracks, keeping what each clip is and dropping the empty rows', () => {
    const out = migrateTracks([
      { ...track('v1', 'video', [clip('v', 0)]), name: 'V1' },
      { ...track('img', 'image', [clip('i', 0)]), name: 'IMG' },
      { ...track('img2', 'image'), name: 'IMG 2' },
      { ...track('txt', 'text'), name: 'TXT' },
      track('a1', 'audio'),
    ]);
    expect(out.map((t) => [t.id, t.name, t.kind])).toEqual([
      ['v1', 'V1', 'video'],
      ['img', 'V2', 'video'],
      ['a1', 'a1', 'audio'],
    ]);
    expect(clipMedia(out[1], out[1].clips[0])).toBe('image');
    expect(clipMedia(out[0], out[0].clips[0])).toBe('video');
  });

  it('keeps a name the user gave and leaves a new timeline untouched', () => {
    const named = { ...track('t', 'image', [clip('i', 0)]), name: 'Time-lapse' };
    expect(migrateTracks([named])[0].name).toBe('Time-lapse');
    const tracks = [track('v1', 'video'), track('a1', 'audio')];
    expect(migrateTracks(tracks)).toBe(tracks);
  });
});

describe('a clip can mix on its own', () => {
  it('its blend wins over the track and its absence falls back to it', () => {
    const c = buildComposition([
      { ...track('v1', 'video', [clip('a', 0, { blend: 'screen' }), clip('b', 2000)]), blend: 'multiply' },
    ]);
    const blendAt = (t: number) => (opsAt(c, t)[1] as MediaOp).blend;
    expect(blendAt(100)).toBe('screen');
    expect(blendAt(2100)).toBe('multiply');
  });
});

describe('video layers decoded while playing', () => {
  const op = (key: string, w: number): CompositionOp =>
    ({ kind: 'video', key, rect: { x: 0, y: 0, w, h: w } }) as unknown as CompositionOp;

  it('keeps the biggest layers, the upper one on a tie', () => {
    const ops = [op('a', 100), op('b', 10), op('c', 100), op('d', 50)];
    expect([...liveLayerKeys(ops, 2)].sort()).toEqual(['a', 'c']);
    expect([...liveLayerKeys(ops, 3)].sort()).toEqual(['a', 'c', 'd']);
    expect(liveLayerKeys(ops, 8).size).toBe(4);
  });

  it('the cap follows the memory of the device', () => {
    expect(liveLayerCap(2)).toBe(2);
    expect(liveLayerCap(4)).toBe(4);
    expect(liveLayerCap(8)).toBe(8);
    expect(liveLayerCap(undefined)).toBe(4);
  });
});

describe('a window border (RF-065)', () => {
  const borderOf = (extra: Partial<Clip>) => {
    const c = buildComposition([track('v1', 'video', [clip('a', 0, extra)])], { width: 1000, height: 500 });
    return (opsAt(c, 100)[1] as MediaOp).border;
  };
  const pip = { pipPosition: { x: 0, y: 0 }, pipSize: { width: 0.5, height: 0.5 } };

  it('is sized by the frame short side and needs a window and a width', () => {
    expect(borderOf({ ...pip, pipBorder: { color: '#fff', width: 2 } })).toEqual({ color: '#fff', px: 10 });
    expect(borderOf({ ...pip, pipBorder: { color: '#fff', width: 0 } })).toBeNull();
    expect(borderOf({ pipBorder: { color: '#fff', width: 2 } })).toBeNull();
  });
});
