import type { Track } from '../domain/Track';

/** Rows top to bottom: the layers from the top one down, then sound. */
export function displayOrder(tracks: readonly Track[]): Track[] {
  return [...tracks.filter((t) => t.kind !== 'audio').reverse(), ...tracks.filter((t) => t.kind === 'audio')];
}
