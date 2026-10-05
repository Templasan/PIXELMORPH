import { requireNativeModule } from 'expo-modules-core';

export interface ExportClip {
  uri: string;
  kind: 'video' | 'image';
  inMs?: number;
  outMs?: number;
  holdMs?: number;
  speed?: number;
  /** Gain of the clip's own audio, 0..1. */
  volume?: number;
  rotation?: number;
  transitionIn?: 'fade' | 'slide' | 'zoom' | 'wipe' | '';
  transitionInMs?: number;
  /** Frame of the clip that leaves (a JPEG), laid over this clip while the transition plays. */
  transitionFrameUri?: string;
  transitionFrameRotation?: number;
  startMs?: number;
}

export interface ExportAudioClip {
  uri: string;
  inMs: number;
  outMs: number;
  /** Where it starts in the finished video. */
  startMs: number;
  /** 0..1 */
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
}

export interface ExportOptions {
  clips: ExportClip[];
  /** Background audio, mixed with the clips' own sound. */
  audio?: ExportAudioClip[];
  width: number;
  height: number;
  bitrate?: number;
  outputPath: string;
}

export interface ExportResult {
  uri: string;
  sizeBytes: number;
  durationMs: number;
}

interface NativeModule {
  exportVideo(options: ExportOptions): Promise<ExportResult>;
  extractFrame(
    uri: string,
    timeMs: number,
    maxWidth: number
  ): Promise<{ uri: string; width: number; height: number }>;
  probeRotation(uri: string): Promise<number | null>;
  cancel(): void;
  addListener(event: 'onProgress', listener: (e: { progress: number }) => void): { remove(): void };
}

const native = requireNativeModule<NativeModule>('PixelMorphVideoExport');

/** Android Media3 Transformer export of the editor timeline into one mp4. */
export function exportVideo(
  options: ExportOptions,
  onProgress?: (percent: number) => void
): Promise<ExportResult> {
  const subscription = onProgress
    ? native.addListener('onProgress', (e) => onProgress(e.progress))
    : null;
  return native.exportVideo(options).finally(() => subscription?.remove());
}

export function cancelVideoExport(): void {
  native.cancel();
}

/** Exact frame of a video at `timeMs` (not just the nearest keyframe), as a cached JPEG. */
export function extractFrame(
  uri: string,
  timeMs: number,
  maxWidth = 0
): Promise<{ uri: string; width: number; height: number }> {
  return native.extractFrame(uri, Math.max(0, Math.round(timeMs)), maxWidth);
}

/** Rotation tag stored in a video file (0/90/180/270), or null if it cannot be read. */
export function probeVideoRotation(uri: string): Promise<number | null> {
  return native.probeRotation(uri);
}
