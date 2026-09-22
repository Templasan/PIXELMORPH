/** Abstraction for video decoding. */
export interface VideoDecoderPort {
  extractFrame(videoUri: string, timestampMs: number): Promise<string>;
  getVideoMetadata(videoUri: string): Promise<{ durationMs: number; width: number; height: number }>;
}

/** Abstraction for video encoding/export. */
export interface VideoEncoderPort {
  encodeVideo(
    frames: string[],
    fps: number,
    width: number,
    height: number,
    outputPath: string,
    quality: 'low' | 'medium' | 'high'
  ): Promise<void>;
}

/** Abstraction for audio processing. */
export interface AudioProcessingPort {
  extractAudio(videoUri: string): Promise<string>;
  mixAudio(videoUri: string, audioUri: string, outputPath: string): Promise<void>;
}

/** Error types for video-editor. */
export class VideoEditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoEditorError';
  }
}

export class EncodingError extends VideoEditorError {
  constructor(message: string) {
    super(`Encoding error: ${message}`);
    this.name = 'EncodingError';
  }
}
