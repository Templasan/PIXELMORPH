import { PhotoCapturePort } from '../../ports';
import { CaptureSettings, PhotoMetadata } from '../../domain';

/** Adapter for Expo Camera photo capture. ponytail: stub until expo-camera integration. */
export class ExpoPhotoCaptureAdapter implements PhotoCapturePort {
  async startCamera(): Promise<void> {
    console.warn('[ExpoCamera] startCamera');
    // TODO: Use expo-camera to start preview
  }

  async stopCamera(): Promise<void> {
    console.warn('[ExpoCamera] stopCamera');
  }

  async capturePhoto(
    _settings: CaptureSettings
  ): Promise<{ uri: string; metadata: PhotoMetadata }> {
    console.warn('[ExpoCamera] capturePhoto');
    // TODO: Use expo-camera to capture
    return {
      uri: '',
      metadata: {
        timestamp: Date.now(),
        exposureTime: 0,
        iso: 100,
        fNumber: 2.0,
        focalLength: 28,
        flashUsed: false,
      },
    };
  }

  async setTorchMode(_enabled: boolean): Promise<void> {
    console.warn('[ExpoCamera] setTorchMode');
    // TODO: Control torch
  }

  async switchCamera(_facing: 'front' | 'back'): Promise<void> {
    console.warn('[ExpoCamera] switchCamera');
    // TODO: Switch camera
  }
}
