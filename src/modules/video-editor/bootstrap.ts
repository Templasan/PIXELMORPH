import { FFmpegDecoderAdapter, FFmpegEncoderAdapter, FFmpegAudioProcessingAdapter } from './infrastructure';
import { VideoDecoderPort, VideoEncoderPort, AudioProcessingPort } from './ports';

/** Composition root for video-editor module. */
export class VideoEditorModuleFactory {
  private static decoderAdapter: VideoDecoderPort | null = null;
  private static encoderAdapter: VideoEncoderPort | null = null;
  private static audioAdapter: AudioProcessingPort | null = null;

  static createDecoderAdapter(): VideoDecoderPort {
    if (!this.decoderAdapter) {
      this.decoderAdapter = new FFmpegDecoderAdapter();
    }
    return this.decoderAdapter;
  }

  static createEncoderAdapter(): VideoEncoderPort {
    if (!this.encoderAdapter) {
      this.encoderAdapter = new FFmpegEncoderAdapter();
    }
    return this.encoderAdapter;
  }

  static createAudioProcessingAdapter(): AudioProcessingPort {
    if (!this.audioAdapter) {
      this.audioAdapter = new FFmpegAudioProcessingAdapter();
    }
    return this.audioAdapter;
  }

  static createVideoEditorModule() {
    const decoderAdapter = this.createDecoderAdapter();
    const encoderAdapter = this.createEncoderAdapter();
    const audioAdapter = this.createAudioProcessingAdapter();

    return {
      // Adapters
      decoderAdapter,
      encoderAdapter,
      audioAdapter,

      // TODO: Wire use cases when they exist
      // For now, just provide adapters for timeline and playback logic
    };
  }
}
