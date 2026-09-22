import { VideoCapturePort } from '../../ports';
import { VideoSettings } from '../../domain';

/** Adapter for Expo Camera video capture. ponytail: stub until expo-camera integration. */
export class ExpoVideoCaptureAdapter implements VideoCapturePort {
  async startVideoRecording(_settings: VideoSettings): Promise<void> {
    console.warn('[ExpoCamera] startVideoRecording');
    // TODO: Start video recording
  }

  async stopVideoRecording(): Promise<{ uri: string; durationMs: number }> {
    console.warn('[ExpoCamera] stopVideoRecording');
    return { uri: '', durationMs: 0 };
  }

  async pauseRecording(): Promise<void> {
    console.warn('[ExpoCamera] pauseRecording');
  }

  async resumeRecording(): Promise<void> {
    console.warn('[ExpoCamera] resumeRecording');
  }
}
