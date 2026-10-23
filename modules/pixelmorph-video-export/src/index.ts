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
  /** 'out' (default): the old frame leaves; 'in': the new clip moves in, pushing it out (slide/wipe). */
  transitionMode?: 'out' | 'in';
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
  /** Seconds between keyframes; omit (0) for the encoder default. Preview proxies pass 1. */
  keyFrameIntervalSeconds?: number;
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
  probeVideo(
    uri: string
  ): Promise<{ width: number; height: number; rotation: number; durationMs: number } | null>;
  cancel(): void;
  heicSupported(): boolean;
  encodeHeic(inputPath: string, outputPath: string, quality: number): Promise<{ sizeBytes: number }>;
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

/** Stored size, rotation tag and duration of a video file from its metadata; null if unreadable. */
export function probeVideo(
  uri: string
): Promise<{ width: number; height: number; rotation: number; durationMs: number } | null> {
  return native.probeVideo(uri);
}

/** RF-057: true on Android 9+ with a HEIC/HEVC encoder; HEIC export is offered only then. */
export function heicSupported(): boolean {
  return native.heicSupported();
}

/** Encodes an image file (PNG/JPEG) into a HEIC file; paths may be file:// URIs. */
export function encodeHeic(
  inputUri: string,
  outputUri: string,
  quality: number
): Promise<{ sizeBytes: number }> {
  const path = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ''));
  return native.encodeHeic(path(inputUri), path(outputUri), Math.round(quality));
}
