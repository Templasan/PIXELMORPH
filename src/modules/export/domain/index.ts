/** Export quality settings. */
export type ExportQuality = 'low' | 'medium' | 'high' | 'lossless';

/** Export format. */
export type ExportFormat = 'jpeg' | 'png' | 'webp' | 'gif';

/** Image export options. */
export interface ImageExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  width?: number; // optional resize
  height?: number;
}

/** Video export options. */
export interface VideoExportOptions {
  quality: ExportQuality;
  fps?: number;
  bitrate?: 'low' | 'medium' | 'high';
}

/** Export result. */
export interface ExportResult {
  uri: string;
  mimeType: string;
  fileSizeBytes: number;
  metadata: Record<string, unknown>;
}
