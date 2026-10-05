import { createStore, useStore, type Store } from '@core/state';

/**
 * Playhead time kept outside React state: the screen reads it on demand (split, freeze, ...)
 * and only the small components that draw it (timecode, playhead, preview) subscribe, so the
 * ~10 Hz clock no longer re-renders the whole editor.
 */
export type TimeStore = Store<number>;

export function createTimeStore(initial = 0): TimeStore {
  return createStore(initial);
}

export function useTime(store: TimeStore): number {
  return useStore(store);
}
