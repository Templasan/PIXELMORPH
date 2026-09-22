import { VideoEncoderPort } from '../../ports';

/** Adapter for FFmpeg video encoding. ponytail: stub until FFmpeg native module integration. */
export class FFmpegEncoderAdapter implements VideoEncoderPort {
  async encodeVideo(
    frames: string[],
    fps: number,
    width: number,
    height: number,
    _outputPath: string,
    quality: 'low' | 'medium' | 'high'
  ): Promise<void> {
    console.warn(
      `[FFmpeg] encodeVideo: ${frames.length} frames @ ${fps}fps, ${width}x${height}, quality=${quality}`
    );
    // TODO: Call native FFmpeg encoder
  }
}
