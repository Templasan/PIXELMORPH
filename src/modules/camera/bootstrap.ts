import {
  ExpoPhotoCaptureAdapter,
  ExpoVideoCaptureAdapter,
  ARJSTrackingAdapter,
} from './infrastructure';
import { PhotoCapturePort, VideoCapturePort, ARTrackingPort } from './ports';

/** Composition root for camera module. */
export class CameraModuleFactory {
  private static photoCaptureAdapter: PhotoCapturePort | null = null;
  private static videoCaptureAdapter: VideoCapturePort | null = null;
  private static arTrackingAdapter: ARTrackingPort | null = null;

  static createPhotoCaptureAdapter(): PhotoCapturePort {
    if (!this.photoCaptureAdapter) {
      this.photoCaptureAdapter = new ExpoPhotoCaptureAdapter();
    }
    return this.photoCaptureAdapter;
  }

  static createVideoCaptureAdapter(): VideoCapturePort {
    if (!this.videoCaptureAdapter) {
      this.videoCaptureAdapter = new ExpoVideoCaptureAdapter();
    }
    return this.videoCaptureAdapter;
  }

  static createARTrackingAdapter(): ARTrackingPort {
    if (!this.arTrackingAdapter) {
      this.arTrackingAdapter = new ARJSTrackingAdapter();
    }
    return this.arTrackingAdapter;
  }

  static createCameraModule() {
    return {
      photoCaptureAdapter: this.createPhotoCaptureAdapter(),
      videoCaptureAdapter: this.createVideoCaptureAdapter(),
      arTrackingAdapter: this.createARTrackingAdapter(),
    };
  }
}
