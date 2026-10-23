import type { MediaPool } from './media';

export interface ProbedMedia {
  durationMs: number;
  width: number;
  height: number;
  /** Rotation tag of the video track (0/90/180/270). */
  rotation: number;
  hasAudio: boolean;
}

/** What a media file is (length, size, sound), read from the file itself. */
export function probeMedia(pool: MediaPool, uri: string): Promise<ProbedMedia> {
  // The file is not on the timeline yet: keep the player's clean-up from closing it meanwhile.
  return pool.withPinned(uri, () => probe(pool, uri));
}

async function probe(pool: MediaPool, uri: string): Promise<ProbedMedia> {
  const input = await pool.input(uri);
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  const durationMs = Math.round((await input.computeDuration()) * 1000);
  return {
    durationMs,
    width: video ? await video.getDisplayWidth() : 0,
    height: video ? await video.getDisplayHeight() : 0,
    rotation: video ? await video.getRotation() : 0,
    hasAudio: !!audio,
  };
}
