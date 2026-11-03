import type { Project } from '@modules/projects';
import {
  buildTimelapseTrack,
  createClip,
  MIN_CLIP_DURATION_MS,
  type Track,
} from '@modules/video-editor';

export const TRACK_COLORS: Record<Track['kind'], string> = {
  video: '#152C44',
  image: '#1E3A5C',
  text: '#1E1E40',
  audio: '#122A1E',
};

/** US-14: seeds a real starting timeline from the open project's own asset (real durationMs). */
export function buildInitialTracks(project: Project | null): Track[] {
  // A video project made only of photos (stop-motion) opens as an image sequence, not with a
  // JPEG on the video track (the player showed black and the exporter rejected the file).
  // shortcut: fixed 200 ms per frame; the fps picked in the camera is not stored yet (US-22).
  const assets = project?.assets ?? [];
  if (assets.length > 0 && assets.every((a) => a.type === 'image')) {
    const frames = buildTimelapseTrack(
      assets.map((a, i) => ({ uri: a.workingUri || a.originalUri, name: `Quadro ${i + 1}` })),
      MIN_CLIP_DURATION_MS,
      TRACK_COLORS.image
    );
    return [
      { id: 'v1', name: 'V1', kind: 'video', visible: true, locked: false, clips: [] },
      { ...frames, id: 'img', name: 'V2' },
      { id: 'a1', name: 'A1', kind: 'audio', visible: true, locked: false, clips: [] },
    ];
  }
  const asset = project?.assets[0];
  // The clip must point at the real media file. It used to prefer the project's thumbnail
  // (a JPEG), so the player and frame extraction never saw the actual video.
  const uri = asset?.workingUri || asset?.originalUri || project?.thumbnailUri;
  const sourceDurationMs = asset?.metadata.durationMs || 10000;
  // RF-018: a camera recording opens with its sound on its own track (A1), at the gain chosen
  // while recording; the video clip itself is muted so the sound is not heard twice.
  const gain = asset?.type === 'video' ? asset.metadata.audioGain : undefined;
  const v1: Track = {
    id: 'v1',
    name: 'V1',
    kind: 'video',
    visible: true,
    locked: false,
    // No media (project without an asset): an empty track, never a stand-in picture.
    clips: uri
      ? [
          {
            ...createClip({
              name: project?.name ?? 'Clipe principal',
              sourceUri: uri,
              color: TRACK_COLORS.video,
              startMs: 0,
              sourceDurationMs,
            }),
            ...(gain !== undefined && { volume: 0 }),
          },
        ]
      : [],
  };
  const a1: Track = {
    id: 'a1',
    name: 'A1',
    kind: 'audio',
    visible: true,
    locked: false,
    clips:
      uri && gain !== undefined
        ? [
            {
              ...createClip({
                name: 'Áudio da câmera',
                sourceUri: uri,
                color: TRACK_COLORS.audio,
                startMs: 0,
                sourceDurationMs,
              }),
              volume: Math.round(gain * 100),
            },
          ]
        : [],
  };
  return [v1, a1];
}
