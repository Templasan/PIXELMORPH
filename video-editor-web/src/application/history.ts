import { createStore } from '../state/createStore';
import type { TracksHistory } from './videoEditorStore';

interface Entry {
  type: string;
  params: { from: unknown; to: unknown };
}

/** What is saved with the project: the most recent undo/redo steps. */
export interface SavedHistory {
  done: Entry[];
  undone: Entry[];
}

/** Steps kept when saving (each holds two timelines; a few KB each). */
const SAVED_STEPS = 50;

/** Undo/redo, saved with the project so it survives closing the editor (see snapshot/restore). */
export function createHistory(limit = 200) {
  const done: Entry[] = [];
  const undone: Entry[] = [];
  const state = createStore({ canUndo: false, canRedo: false });
  const sync = () => state.set({ canUndo: done.length > 0, canRedo: undone.length > 0 });
  const history: TracksHistory = {
    push(type, from, to) {
      done.push({ type, params: { from, to } });
      if (done.length > limit) done.shift();
      undone.length = 0;
      sync();
    },
    undo() {
      const e = done.pop();
      if (e) undone.push(e);
      sync();
      return e;
    },
    redo() {
      const e = undone.pop();
      if (e) done.push(e);
      sync();
      return e;
    },
  };
  return {
    history,
    state,
    snapshot(): SavedHistory {
      return { done: done.slice(-SAVED_STEPS), undone: undone.slice(-SAVED_STEPS) };
    },
    restore(saved: SavedHistory | undefined) {
      done.length = 0;
      undone.length = 0;
      if (saved) {
        done.push(...saved.done);
        undone.push(...saved.undone);
      }
      sync();
    },
  };
}
