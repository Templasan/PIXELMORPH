import { createStore } from '../state/createStore';
import type { TracksHistory } from './videoEditorStore';

interface Entry {
  type: string;
  params: { from: unknown; to: unknown };
}

/** Undo/redo in memory (the app persists it through its own history later). */
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
  return { history, state };
}
