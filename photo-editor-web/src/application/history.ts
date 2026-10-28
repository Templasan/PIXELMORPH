import { createStore } from '../state/createStore';
import { PRESET_OP, type AdjustmentsHistory } from './photoEditorStore';
import type { HistoryOp, SavedHistory } from '../ports/host';

const MAX_STEPS = 200;
let counter = 0;

/**
 * The editor's undo log, in the same operation format the app's core/history used, so the old
 * log of a project opened for the first time continues here. Saved with the project.
 */
export function createHistory(saved?: SavedHistory | null) {
  const state = createStore<SavedHistory>({
    done: saved?.done.slice(-MAX_STEPS) ?? [],
    undone: saved?.undone ?? [],
  });
  const log: AdjustmentsHistory = {
    push(type, from, to) {
      counter += 1;
      const op = { id: `op_${Date.now()}_${counter}`, type, params: { from, to }, timestamp: Date.now() };
      const done = [...state.get().done, op].slice(-MAX_STEPS);
      state.set({ done, undone: [] });
    },
    undo() {
      const { done, undone } = state.get();
      const op = done.at(-1);
      if (op) state.set({ done: done.slice(0, -1), undone: [...undone, op] });
      return op as ReturnType<AdjustmentsHistory['undo']>;
    },
    redo() {
      const { done, undone } = state.get();
      const op = undone.at(-1);
      if (op) state.set({ done: [...done, op], undone: undone.slice(0, -1) });
      return op as ReturnType<AdjustmentsHistory['redo']>;
    },
    clearFields(types) {
      const keep = (op: HistoryOp) => !types.includes(op.type);
      const { done, undone } = state.get();
      state.set({ done: done.filter(keep), undone: undone.filter(keep) });
    },
  };
  return { state, log };
}

/** The adjustments a log ends at: each field's last value, on top of `base`. */
export function replay<T extends Record<string, unknown>>(base: T, done: readonly HistoryOp[]): T {
  const out: Record<string, unknown> = { ...base };
  for (const op of done) {
    if (op.type === PRESET_OP) Object.assign(out, op.params.to);
    else if (op.type in base) out[op.type] = op.params.to;
  }
  return out as T;
}
