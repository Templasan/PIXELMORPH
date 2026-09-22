import { AudioRecordingPort } from '../../ports';
import { AudioRecordingSettings, AudioMetadata } from '../../domain';

/** Adapter for expo-audio recording. ponytail: stub until expo-audio integration. */
export class ExpoAudioRecordingAdapter implements AudioRecordingPort {
  async startRecording(_settings: AudioRecordingSettings): Promise<void> {
    console.warn('[ExpoAudio] startRecording');
    // TODO: Use expo-audio to start recording
  }

  async stopRecording(): Promise<{ uri: string; metadata: AudioMetadata }> {
    console.warn('[ExpoAudio] stopRecording');
    return {
      uri: '',
      metadata: {
        durationMs: 0,
        sampleRate: 44100,
        channels: 1,
        bitrate: 128000,
        format: 'aac',
      },
    };
  }

  async pauseRecording(): Promise<void> {
    console.warn('[ExpoAudio] pauseRecording');
  }

  async resumeRecording(): Promise<void> {
    console.warn('[ExpoAudio] resumeRecording');
  }
}
