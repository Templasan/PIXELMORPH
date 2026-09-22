import { CaptureSettings, PhotoMetadata, VideoSettings, ARTrackingState } from '../domain';

/** Abstraction for photo capture. */
export interface PhotoCapturePort {
  startCamera(): Promise<void>;
  stopCamera(): Promise<void>;
  capturePhoto(settings: CaptureSettings): Promise<{ uri: string; metadata: PhotoMetadata }>;
  setTorchMode(enabled: boolean): Promise<void>;
  switchCamera(facing: 'front' | 'back'): Promise<void>;
}

/** Abstraction for video capture. */
export interface VideoCapturePort {
  startVideoRecording(settings: VideoSettings): Promise<void>;
  stopVideoRecording(): Promise<{ uri: string; durationMs: number }>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
}

/** Abstraction for AR tracking. */
export interface ARTrackingPort {
  startTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  getTrackingState(): Promise<ARTrackingState>;
}

/** Camera module errors. */
export class CameraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CameraError';
  }
}

export class CameraPermissionError extends CameraError {
  constructor() {
    super('Camera permission denied');
    this.name = 'CameraPermissionError';
  }
}
