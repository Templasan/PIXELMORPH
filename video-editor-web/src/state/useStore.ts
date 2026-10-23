import { useMemo, useSyncExternalStore } from 'react';
import { createSelection, type Store } from './createStore';

const identity = <T>(state: T) => state;

/**
 * Subscribes a component to `store`, re-rendering only when `selector`'s result changes
 * (by `isEqual`; pass `shallowEqual` for selectors that build an object/array).
 */
export function useStore<T, S = T>(
  store: Store<T>,
  selector: (state: T) => S = identity as (state: T) => S,
  isEqual: (a: S, b: S) => boolean = Object.is
): S {
  const select = useMemo(() => createSelection(store), [store]);
  const getSnapshot = () => select(selector, isEqual);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
