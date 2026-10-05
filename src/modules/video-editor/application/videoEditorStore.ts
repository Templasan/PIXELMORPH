import { createStore, type Store } from '@core/state';
import { clipEndMs, type Clip, type Track } from '../domain/Track';
import {
  appendClip,
  ensureImageTrack,
  findClip,
  rippleShiftAfter,
  splitClipAtMs,
  trimClipIn,
  trimClipOut,
} from '../domain/timeline';
import { insertFreezeFrame } from '../domain/freezeFrame';

/** The undo log the store records into (core/history's usePersistedHistory fits it). */
export interface TracksHistory {
  push(type: string, from: unknown, to: unknown): void;
  undo(): { type: string; params: { from: unknown; to: unknown } } | undefined;
  redo(): { type: string; params: { from: unknown; to: unknown } } | undefined;
}

export interface VideoEditorState {
  tracks: Track[];
  selectedClipId: string | null;
  playing: boolean;
  rippleMode: boolean;
  freezeHoldMs: number;
  loopReview: boolean;
  timelineZoom: number;
}

const HISTORY_TYPE = 'tracks';

export function initialVideoEditorState(tracks: Track[] = []): VideoEditorState {
  return {
    tracks,
    selectedClipId: null,
    playing: false,
    rippleMode: false,
    freezeHoldMs: 2000,
    loopReview: false,
    timelineZoom: 50,
  };
}

/** The selected clip and its track, or null. */
export function selectedClipOf(state: VideoEditorState) {
  return state.selectedClipId ? findClip(state.tracks, state.selectedClipId) : null;
}

/** Replaces one clip (by id) in its track. */
export function mapClip(tracks: Track[], clipId: string, fn: (clip: Clip) => Clip): Track[] {
  return tracks.map((t) =>
    t.clips.some((c) => c.id === clipId)
      ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? fn(c) : c)) }
      : t
  );
}

/**
 * The video editor's state and every timeline edit, outside React. Components subscribe to the
 * slice they draw (useStore + selector), so a slider or a drag no longer re-renders the screen.
 *
 * Edits go through one of two paths:
 * - `commit(fn)`: a discrete action (button, chip) → one undo entry.
 * - gesture: `live(fn)` any number of times (drag, slider; the first call snapshots the
 *   timeline), then `endGesture()` → one undo entry from the snapshot to the result. `fn`
 *   always receives the snapshot, so live updates never accumulate rounding.
 */
export function createVideoEditorStore(
  history: TracksHistory,
  initial?: Partial<VideoEditorState>
) {
  const store: Store<VideoEditorState> = createStore({
    ...initialVideoEditorState(),
    ...initial,
  });
  let gestureStart: Track[] | null = null;

  const get = () => store.get();
  const set = (patch: Partial<VideoEditorState>) => store.set((s) => ({ ...s, ...patch }));
  const setTracks = (tracks: Track[]) => set({ tracks });

  function commit(fn: (tracks: Track[]) => Track[]) {
    const before = get().tracks;
    const after = fn(before);
    if (after === before) return;
    setTracks(after);
    history.push(HISTORY_TYPE, before, after);
  }

  function beginGesture() {
    gestureStart ??= get().tracks;
  }

  function live(fn: (start: Track[]) => Track[]) {
    beginGesture();
    setTracks(fn(gestureStart!));
  }

  function endGesture() {
    const before = gestureStart;
    gestureStart = null;
    if (before && before !== get().tracks) history.push(HISTORY_TYPE, before, get().tracks);
  }

  function restore(op: ReturnType<TracksHistory['undo']>, side: 'from' | 'to') {
    if (op?.type === HISTORY_TYPE) setTracks(ensureImageTrack(op.params[side] as Track[]));
  }

  /** Runs `fn` on the selected clip (no-op without a selection). */
  function withSelected(fn: (sel: NonNullable<ReturnType<typeof selectedClipOf>>) => void) {
    const sel = selectedClipOf(get());
    if (sel) fn(sel);
  }

  /** Trims the out-point and, in Ripple mode, shifts every later clip to close the gap. */
  function trimOutWithRipple(newOutPointMs: number) {
    withSelected(({ track, clip }) =>
      commit((before) => {
        let after = trimClipOut(before, track.id, clip.id, newOutPointMs);
        if (get().rippleMode) {
          const trimmed = findClip(after, clip.id)?.clip;
          if (trimmed) {
            const oldEnd = clipEndMs(clip);
            after = rippleShiftAfter(after, track.id, oldEnd, clipEndMs(trimmed) - oldEnd);
          }
        }
        return after;
      })
    );
  }

  return {
    store,

    /** Loads the timeline (seeded project + replayed history); ignored mid-gesture. */
    hydrate(tracks: Track[]) {
      if (gestureStart) return;
      setTracks(ensureImageTrack(tracks));
    },

    commit,
    beginGesture,
    live,
    endGesture,
    get gestureActive() {
      return gestureStart !== null;
    },

    undo: () => restore(history.undo(), 'from'),
    redo: () => restore(history.redo(), 'to'),

    /** Selected-clip edits: discrete (`commitClip`) or live from a slider (`liveClip`). */
    commitClip(fn: (clip: Clip) => Clip) {
      withSelected(({ clip }) => commit((t) => mapClip(t, clip.id, fn)));
    },
    liveClip(fn: (clip: Clip) => Clip) {
      withSelected(({ clip }) => live((start) => mapClip(start, clip.id, fn)));
    },
    /** Selected-clip edit through a whole-timeline domain function (setTransition, ramps...). */
    commitOnSelected(fn: (tracks: Track[], trackId: string, clip: Clip) => Track[]) {
      withSelected(({ track, clip }) => commit((t) => fn(t, track.id, clip)));
    },
    liveOnSelected(fn: (start: Track[], trackId: string, clip: Clip) => Track[]) {
      withSelected(({ track, clip }) => live((start) => fn(start, track.id, clip)));
    },

    split(atMs: number) {
      withSelected(({ track, clip }) => commit((t) => splitClipAtMs(t, track.id, clip.id, atMs)));
    },
    cut(atMs: number) {
      withSelected(({ clip }) => trimOutWithRipple(clip.inPointMs + (atMs - clip.startMs)));
    },
    freeze(atMs: number) {
      withSelected(({ track, clip }) =>
        commit((t) => insertFreezeFrame(t, track.id, clip.id, atMs, get().freezeHoldMs))
      );
    },
    nudgeTrimIn(deltaMs: number) {
      withSelected(({ track, clip }) =>
        commit((t) => trimClipIn(t, track.id, clip.id, clip.inPointMs + deltaMs))
      );
    },
    nudgeTrimOut(deltaMs: number) {
      withSelected(({ clip }) => trimOutWithRipple(clip.outPointMs + deltaMs));
    },
    addClip(trackId: string, clip: Clip) {
      commit((t) => appendClip(t, trackId, clip));
    },
    addTrack(track: Track) {
      commit((t) => [...t, track]);
    },
    /** Visibility and lock are view state: not undoable (unchanged from before the store). */
    toggleVisible(trackId: string) {
      setTracks(get().tracks.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t)));
    },
    toggleLocked(trackId: string) {
      setTracks(get().tracks.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)));
    },

    toggleSelect(clipId: string) {
      set({ selectedClipId: get().selectedClipId === clipId ? null : clipId });
    },
    clearSelection: () => set({ selectedClipId: null }),
    setPlaying: (playing: boolean) => set({ playing }),
    togglePlaying: () => set({ playing: !get().playing }),
    toggleRipple: () => set({ rippleMode: !get().rippleMode }),
    setFreezeHoldMs: (freezeHoldMs: number) => set({ freezeHoldMs }),
    setLoopReview: (loopReview: boolean) => set({ loopReview }),
    setTimelineZoom: (timelineZoom: number) => set({ timelineZoom }),
  };
}

export type VideoEditorStore = ReturnType<typeof createVideoEditorStore>;
