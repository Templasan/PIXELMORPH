/**
 * A single reversible edit, per ADR-002 (non-destructive editing via an operation store).
 * `type` names the field/action; `params.from`/`params.to` let undo/redo apply the inverse
 * without the caller needing to keep its own separate history.
 */
export interface Operation<TValue = unknown> {
  id: string;
  type: string;
  params: {
    from: TValue;
    to: TValue;
    [key: string]: unknown;
  };
  timestamp: number;
}

let counter = 0;

/** Monotonic-enough id for operations created within one session (timestamp + counter). */
export function createOperationId(): string {
  counter += 1;
  return `op_${Date.now()}_${counter}`;
}

export function createOperation<TValue>(
  type: string,
  from: TValue,
  to: TValue,
  extraParams: Record<string, unknown> = {}
): Operation<TValue> {
  return {
    id: createOperationId(),
    type,
    params: { from, to, ...extraParams },
    timestamp: Date.now(),
  };
}
