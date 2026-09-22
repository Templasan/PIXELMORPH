import {
  ExpoAudioRecordingAdapter,
  ExpoAudioPlaybackAdapter,
  FFmpegAudioProcessingAdapter,
} from './infrastructure';
import { AudioRecordingPort, AudioPlaybackPort, AudioProcessingPort } from './ports';

/** Composition root for audio module. */
export class AudioModuleFactory {
  private static recordingAdapter: AudioRecordingPort | null = null;
  private static playbackAdapter: AudioPlaybackPort | null = null;
  private static processingAdapter: AudioProcessingPort | null = null;

  static createRecordingAdapter(): AudioRecordingPort {
    if (!this.recordingAdapter) {
      this.recordingAdapter = new ExpoAudioRecordingAdapter();
    }
    return this.recordingAdapter;
  }

  static createPlaybackAdapter(): AudioPlaybackPort {
    if (!this.playbackAdapter) {
      this.playbackAdapter = new ExpoAudioPlaybackAdapter();
    }
    return this.playbackAdapter;
  }

  static createProcessingAdapter(): AudioProcessingPort {
    if (!this.processingAdapter) {
      this.processingAdapter = new FFmpegAudioProcessingAdapter();
    }
    return this.processingAdapter;
  }

  static createAudioModule() {
    return {
      recordingAdapter: this.createRecordingAdapter(),
      playbackAdapter: this.createPlaybackAdapter(),
      processingAdapter: this.createProcessingAdapter(),
    };
  }
}
