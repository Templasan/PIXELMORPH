import { Operation } from './Operation';

export interface HistorySnapshot {
  past: Operation[];
  future: Operation[];
}

/**
 * Unlimited undo/redo stack (RF-027). Pure in-memory bookkeeping — persistence is a
 * separate concern (see HistoryRepository) so this class stays trivially testable.
 */
export class HistoryStore {
  private past: Operation[] = [];
  private future: Operation[] = [];

  constructor(snapshot?: HistorySnapshot) {
    if (snapshot) {
      this.past = [...snapshot.past];
      this.future = [...snapshot.future];
    }
  }

  /** Record a new operation. Any redo-able future is discarded, matching standard editor UX. */
  push(operation: Operation): void {
    this.past.push(operation);
    this.future = [];
  }

  /** Returns the operation to revert, or undefined if there's nothing to undo. */
  undo(): Operation | undefined {
    const operation = this.past.pop();
    if (!operation) return undefined;
    this.future.unshift(operation);
    return operation;
  }

  /** Returns the operation to re-apply, or undefined if there's nothing to redo. */
  redo(): Operation | undefined {
    const operation = this.future.shift();
    if (!operation) return undefined;
    this.past.push(operation);
    return operation;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Full applied history, oldest first — used for the "História" properties tab. */
  get log(): readonly Operation[] {
    return this.past;
  }

  toSnapshot(): HistorySnapshot {
    return { past: [...this.past], future: [...this.future] };
  }

  /**
   * Replays the applied operations to reconstruct current field values, keeping only the
   * last value written per operation `type`. Lets a screen restore its state after reopening.
   */
  reconstructState<T extends Record<string, unknown>>(initial: T): T {
    const state = { ...initial };
    for (const op of this.past) {
      if (op.type in state) {
        (state as Record<string, unknown>)[op.type] = op.params.to;
      }
    }
    return state;
  }
}
