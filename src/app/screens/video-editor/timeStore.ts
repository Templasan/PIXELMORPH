import { useSyncExternalStore } from 'react';

/**
 * Playhead time kept outside React state: the screen reads it on demand (split, freeze, ...)
 * and only the small components that draw it (timecode, playhead, preview) subscribe, so the
 * ~10 Hz clock no longer re-renders the whole editor.
 */
export interface TimeStore {
  get: () => number;
  set: (next: number | ((prev: number) => number)) => void;
  subscribe: (cb: () => void) => () => void;
}

export function createTimeStore(initial = 0): TimeStore {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      const v = typeof next === 'function' ? next(value) : next;
      if (v === value) return;
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

export function useTime(store: TimeStore): number {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
