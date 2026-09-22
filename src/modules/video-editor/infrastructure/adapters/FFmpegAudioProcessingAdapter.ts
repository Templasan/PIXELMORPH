import { AudioProcessingPort } from '../../ports';

/** Adapter for FFmpeg audio processing. ponytail: stub until implementation. */
export class FFmpegAudioProcessingAdapter implements AudioProcessingPort {
  async extractAudio(videoUri: string): Promise<string> {
    console.warn(`[FFmpeg] extractAudio from ${videoUri}`);
    // TODO: Extract audio stream
    return '';
  }

  async mixAudio(videoUri: string, audioUri: string, _outputPath: string): Promise<void> {
    console.warn(`[FFmpeg] mixAudio: video=${videoUri}, audio=${audioUri}`);
    // TODO: Mix audio streams
  }
}
