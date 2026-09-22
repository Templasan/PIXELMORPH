import { VideoExportPort } from '../../ports';
import { VideoExportOptions, ExportResult } from '../../domain';

/** Adapter for video export using FFmpeg. ponytail: stub until FFmpeg integration. */
export class FFmpegVideoExportAdapter implements VideoExportPort {
  async exportVideo(
    _videoUri: string,
    options: VideoExportOptions,
    _outputPath: string
  ): Promise<ExportResult> {
    console.warn(`[FFmpeg] Video export: quality=${options.quality}`);
    // TODO: Use FFmpeg to encode and save
    return {
      uri: '',
      mimeType: 'video/mp4',
      fileSizeBytes: 0,
      metadata: {},
    };
  }
}
