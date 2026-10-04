import { requireNativeModule } from 'expo-modules-core';

export interface ExportClip {
  uri: string;
  kind: 'video' | 'image';
  inMs?: number;
  outMs?: number;
  holdMs?: number;
  speed?: number;
  rotation?: number;
}

export interface ExportOptions {
  clips: ExportClip[];
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
  cancel(): void;
  addListener(
    event: 'onProgress',
    listener: (e: { progress: number }) => void
  ): { remove(): void };
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
