import { createStore } from '../state/createStore';
import { LAYERS_OP, PRESET_OP, type AdjustmentsHistory } from './photoEditorStore';
import type { HistoryOp, SavedHistory } from '../ports/host';

const MAX_STEPS = 200;
let counter = 0;

const fieldsOf = (op: HistoryOp) =>
  op.type === PRESET_OP ? Object.keys(op.params.to as Record<string, number>) : [op.type];

/**
 * Keeps the log within MAX_STEPS per kind of step. Adjustments live only in this log (the project
 * replays it on open), so the step dropped is the oldest one whose fields a later step overwrites:
 * undo gets shorter, the picture stays the same. Layer steps are never saved, so age decides.
 */
function trim(done: HistoryOp[]): HistoryOp[] {
  const out = [...done];
  const layerSteps = out.filter((op) => op.type === LAYERS_OP);
  if (layerSteps.length > MAX_STEPS) out.splice(out.indexOf(layerSteps[0]), 1);
  while (out.length - Math.min(layerSteps.length, MAX_STEPS) > MAX_STEPS) {
    const looks = out.filter((op) => op.type !== LAYERS_OP);
    const victim = looks.find((op, i) => {
      const later = new Set(looks.slice(i + 1).flatMap(fieldsOf));
      return fieldsOf(op).every((f) => later.has(f));
    });
    out.splice(out.indexOf(victim ?? looks[0]), 1);
  }
  return out;
}

/**
 * The editor's undo log, in the same operation format the app's core/history used, so the old
 * log of a project opened for the first time continues here. Saved with the project.
 */
export function createHistory(saved?: SavedHistory | null) {
  const state = createStore<SavedHistory>({
    done: trim(saved?.done ?? []),
    undone: saved?.undone ?? [],
  });
  const log: AdjustmentsHistory = {
    push(type, from, to) {
      counter += 1;
      const op = { id: `op_${Date.now()}_${counter}`, type, params: { from, to }, timestamp: Date.now() };
      state.set({ done: trim([...state.get().done, op]), undone: [] });
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
