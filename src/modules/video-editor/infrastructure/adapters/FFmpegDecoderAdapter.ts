import { VideoDecoderPort } from '../../ports';

/** Adapter for FFmpeg video decoding. ponytail: stub until FFmpeg native module integration. */
export class FFmpegDecoderAdapter implements VideoDecoderPort {
  async extractFrame(videoUri: string, timestampMs: number): Promise<string> {
    console.warn(`[FFmpeg] extractFrame at ${timestampMs}ms from ${videoUri}`);
    // TODO: Call native FFmpeg module
    return '';
  }

  async getVideoMetadata(
    videoUri: string
  ): Promise<{ durationMs: number; width: number; height: number }> {
    console.warn(`[FFmpeg] getVideoMetadata from ${videoUri}`);
    // TODO: Call native FFmpeg module to probe video
    return { durationMs: 0, width: 1080, height: 1920 };
  }
}
