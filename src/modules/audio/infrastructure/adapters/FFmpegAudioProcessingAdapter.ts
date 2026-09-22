import { AudioProcessingPort } from '../../ports';

/** Adapter for FFmpeg audio processing. ponytail: stub until FFmpeg integration. */
export class FFmpegAudioProcessingAdapter implements AudioProcessingPort {
  async trim(_audioUri: string, _startMs: number, _endMs: number, _outputPath: string): Promise<void> {
    console.warn('[FFmpeg] trim audio');
    // TODO: Use FFmpeg to trim
  }

  async merge(_audioUris: string[], _outputPath: string): Promise<void> {
    console.warn('[FFmpeg] merge audio');
    // TODO: Use FFmpeg to merge
  }

  async normalize(_audioUri: string, _outputPath: string): Promise<void> {
    console.warn('[FFmpeg] normalize audio');
    // TODO: Use FFmpeg to normalize
  }
}
