import { ImageExportOptions, VideoExportOptions, ExportResult } from '../domain';

/** Abstraction for image export. */
export interface ImageExportPort {
  exportImage(imageUri: string, options: ImageExportOptions, outputPath: string): Promise<ExportResult>;
}

/** Abstraction for video export. */
export interface VideoExportPort {
  exportVideo(videoUri: string, options: VideoExportOptions, outputPath: string): Promise<ExportResult>;
}

/** Abstraction for sharing. */
export interface SharePort {
  shareImage(imageUri: string): Promise<void>;
  shareVideo(videoUri: string): Promise<void>;
}

/** Export errors. */
export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

export class ExportQualityError extends ExportError {
  constructor(message: string) {
    super(`Quality error: ${message}`);
    this.name = 'ExportQualityError';
  }
}
