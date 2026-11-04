import { requireNativeModule } from 'expo-modules-core';

/** Normalized to the picture. Landmarks are null when the face is turned too far to see them. */
export interface DetectedFace {
  x: number;
  y: number;
  w: number;
  h: number;
  leftEye: { x: number; y: number } | null;
  rightEye: { x: number; y: number } | null;
  mouthLeft: { x: number; y: number } | null;
  mouthRight: { x: number; y: number } | null;
  mouthBottom: { x: number; y: number } | null;
}

/** Times count from the in-point asked for. */
export interface SpeechSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface SpeechProgress {
  stage: 'model' | 'audio' | 'speech';
  percent: number;
}

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
  segmentSubject(inputUri: string, outputPath: string): Promise<{ uri: string; width: number; height: number }>;
  speechModelReady(): boolean;
  transcribeSpeech(uri: string, inMs: number, outMs: number): Promise<SpeechSegment[]>;
  cancelSpeech(): void;
  labelImage(uri: string): Promise<{ text: string; confidence: number }[]>;
  detectFaces(uri: string): Promise<DetectedFace[]>;
  probeRotation(uri: string): Promise<number | null>;
  probeVideo(
    uri: string
  ): Promise<{ width: number; height: number; rotation: number; durationMs: number } | null>;
  probeCodecs(uri: string): Promise<string[]>;
  cancel(): void;
  heicSupported(): boolean;
  encodeHeic(
    inputPath: string,
    outputPath: string,
    quality: number
  ): Promise<{ sizeBytes: number }>;
  addListener(event: 'onProgress', listener: (e: { progress: number }) => void): { remove(): void };
  addListener(event: 'onSpeechProgress', listener: (e: SpeechProgress) => void): { remove(): void };
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
/** RF-069: true once the speech model is on the device. */
export function speechModelReady(): boolean {
  return native.speechModelReady();
}

/** RF-069: what is said in a stretch of a file, heard on the device; fetches the model if needed. */
export function transcribeSpeech(
  uri: string,
  inMs: number,
  outMs: number,
  onProgress: (progress: SpeechProgress) => void
): Promise<SpeechSegment[]> {
  const subscription = native.addListener('onSpeechProgress', onProgress);
  return native.transcribeSpeech(uri, inMs, outMs).finally(() => subscription.remove());
}

export function cancelSpeech(): void {
  native.cancelSpeech();
}

/** RF-034: what a photo shows, read on the device. */
export function labelImage(uri: string) {
  return native.labelImage(uri);
}

/** RF-016: where a photo's faces are, read on the device. */
export function detectFaces(uri: string) {
  return native.detectFaces(uri);
}

/** RF-004: a PNG of a photo's main subject, transparent elsewhere. Rejects with a code when it cannot. */
export function segmentSubject(inputUri: string, outputPath: string) {
  return native.segmentSubject(inputUri, outputPath);
}

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

/** RF-037: the codecs of a media file's tracks as the platform names them (e.g. video/avc); [] if unreadable. */
export function probeCodecs(uri: string): Promise<string[]> {
  return native.probeCodecs(uri);
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
