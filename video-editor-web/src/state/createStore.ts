/**
 * Editor state kept outside React. Components subscribe through `useStore` with a selector, so
 * a change re-renders only the components whose selected slice actually changed — not the
 * whole screen. Generalizes the video editor's time store (one value, ~10 Hz, no re-renders).
 *
 * Pure (no React import) so it runs under Jest; the hook lives in ./useStore.
 */
export interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (cb: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      const v = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
      if (Object.is(v, value)) return;
      value = v;
      subs.forEach((cb) => cb());
    },
    subscribe: (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}

/**
 * Snapshot getter for `useSyncExternalStore` that hands back the previous selection while it is
 * still equal — a selector returning a fresh object/array would otherwise re-render on every
 * store change (and loop forever, since useSyncExternalStore compares snapshots by identity).
 */
export function createSelection<T>(store: Pick<Store<T>, 'get'>) {
  let memo: { state: T; selector: unknown; selection: unknown } | null = null;
  return <S>(selector: (state: T) => S, isEqual: (a: S, b: S) => boolean): S => {
    const state = store.get();
    if (memo && memo.state === state && memo.selector === selector) return memo.selection as S;
    const selection = selector(state);
    if (memo && isEqual(memo.selection as S, selection)) {
      memo = { state, selector, selection: memo.selection };
      return memo.selection as S;
    }
    memo = { state, selector, selection };
    return selection;
  };
}

/** One-level equality for selectors that return a small object or array of fields. */
export function shallowEqual<S>(a: S, b: S): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}
