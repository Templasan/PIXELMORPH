import {
  createVideoEditorStore,
  selectedClipOf,
  type TracksHistory,
} from '@modules/video-editor/application/videoEditorStore';
import { createClip, clipEndMs, type Track } from '@modules/video-editor/domain/Track';
import { setTransition } from '@modules/video-editor/domain/transitions';

// Characterization of VideoEditorScreen's editing behaviour (US-15/16/17), now owned by the
// store: one undo entry per discrete action, one per gesture, undo/redo restore the timeline.

function fakeHistory() {
  const past: { type: string; params: { from: unknown; to: unknown } }[] = [];
  const future: typeof past = [];
  const history: TracksHistory = {
    push: (type, from, to) => {
      past.push({ type, params: { from, to } });
      future.length = 0;
    },
    undo: () => {
      const op = past.pop();
      if (op) future.unshift(op);
      return op;
    },
    redo: () => {
      const op = future.shift();
      if (op) past.push(op);
      return op;
    },
  };
  return { history, past };
}

function timeline(): Track[] {
  const clip = (name: string, startMs: number) =>
    createClip({
      name,
      sourceUri: `file:///m/${name}.mp4`,
      color: '#000',
      startMs,
      sourceDurationMs: 4000,
    });
  return [
    {
      id: 'v1',
      name: 'V1',
      kind: 'video',
      visible: true,
      locked: false,
      clips: [clip('a', 0), clip('b', 4000)],
    },
    { id: 'img', name: 'IMG', kind: 'image', visible: true, locked: false, clips: [] },
  ];
}

function setup() {
  const { history, past } = fakeHistory();
  const editor = createVideoEditorStore(history);
  editor.hydrate(timeline());
  const [a, b] = editor.store.get().tracks[0].clips;
  return { editor, past, a, b, tracks: () => editor.store.get().tracks };
}

describe('video editor store', () => {
  it('a discrete edit records exactly one undo entry; a no-op records none', () => {
    const { editor, past, a } = setup();
    editor.toggleSelect(a.id);
    editor.split(2000);
    expect(past).toHaveLength(1);
    expect(editor.store.get().tracks[0].clips).toHaveLength(3);
    editor.commit((t) => t);
    expect(past).toHaveLength(1);
  });

  it('a gesture (drag/slider) records one entry from its start, however many live updates', () => {
    const { editor, past, a, tracks } = setup();
    editor.toggleSelect(a.id);
    const before = tracks();
    editor.liveClip((c) => ({ ...c, speed: 1.5 }));
    editor.liveClip((c) => ({ ...c, speed: 2 }));
    editor.liveClip((c) => ({ ...c, speed: 3 }));
    editor.endGesture();
    expect(past).toHaveLength(1);
    expect(past[0].params.from).toBe(before);
    expect(selectedClipOf(editor.store.get())!.clip.speed).toBe(3);
  });

  it('live updates always start from the gesture snapshot (drag deltas do not accumulate)', () => {
    const { editor, a, tracks } = setup();
    editor.beginGesture();
    editor.live((start) =>
      start.map((t) => ({
        ...t,
        clips: t.clips.map((c) => (c.id === a.id ? { ...c, startMs: c.startMs + 100 } : c)),
      }))
    );
    editor.live((start) =>
      start.map((t) => ({
        ...t,
        clips: t.clips.map((c) => (c.id === a.id ? { ...c, startMs: c.startMs + 300 } : c)),
      }))
    );
    expect(tracks()[0].clips[0].startMs).toBe(300);
  });

  it('a gesture that ends where it started records nothing', () => {
    const { editor, past } = setup();
    editor.beginGesture();
    editor.endGesture();
    expect(past).toHaveLength(0);
  });

  it('hydrating mid-gesture is ignored so a late history load cannot clobber a drag', () => {
    const { editor, a, tracks } = setup();
    editor.toggleSelect(a.id);
    editor.liveClip((c) => ({ ...c, colorCorrection: 40 }));
    editor.hydrate(timeline());
    expect(selectedClipOf(editor.store.get())!.clip.colorCorrection).toBe(40);
    editor.endGesture();
    expect(tracks()[0].clips[0].colorCorrection).toBe(40);
  });

  it('undo and redo restore the timeline (and re-add a missing image track)', () => {
    const { editor, a, tracks } = setup();
    const original = tracks();
    editor.toggleSelect(a.id);
    editor.split(1000);
    const split = tracks();
    editor.undo();
    expect(tracks()).toBe(original);
    editor.redo();
    expect(tracks()).toBe(split);
  });

  it('cut trims the selected clip at the playhead; in Ripple mode later clips close the gap', () => {
    const { editor, a, b, tracks } = setup();
    editor.toggleSelect(a.id);
    editor.cut(1000);
    expect(clipEndMs(tracks()[0].clips[0])).toBe(1000);
    expect(tracks()[0].clips[1].startMs).toBe(b.startMs);

    const ripple = setup();
    ripple.editor.toggleRipple();
    ripple.editor.toggleSelect(ripple.a.id);
    ripple.editor.cut(1000);
    expect(ripple.tracks()[0].clips[1].startMs).toBe(1000);
  });

  it('freeze inserts a held frame of the configured length', () => {
    const { editor, a, tracks } = setup();
    editor.setFreezeHoldMs(1500);
    editor.toggleSelect(a.id);
    editor.freeze(2000);
    const frozen = tracks()[0].clips.find((c) => c.frozen);
    expect(frozen?.holdMs).toBe(1500);
  });

  it('transition on the selected clip goes through the whole-timeline domain function', () => {
    const { editor, b, past } = setup();
    editor.toggleSelect(b.id);
    editor.commitOnSelected((t, trackId, clip) =>
      setTransition(t, trackId, clip.id, { type: 'fade', durationMs: 500 })
    );
    expect(selectedClipOf(editor.store.get())!.clip.transitionIn).toEqual({
      type: 'fade',
      durationMs: 500,
    });
    expect(past).toHaveLength(1);
  });

  it('track visibility/lock are view state and are not undoable', () => {
    const { editor, past, tracks } = setup();
    editor.toggleVisible('v1');
    editor.toggleLocked('v1');
    expect(tracks()[0]).toMatchObject({ visible: false, locked: true });
    expect(past).toHaveLength(0);
  });

  it('edits without a selection are no-ops', () => {
    const { editor, past } = setup();
    editor.split(1000);
    editor.liveClip((c) => ({ ...c, speed: 2 }));
    editor.endGesture();
    expect(past).toHaveLength(0);
  });
});
