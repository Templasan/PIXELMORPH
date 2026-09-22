/** Camera capture settings. */
export interface CaptureSettings {
  width: number;
  height: number;
  quality: 'low' | 'medium' | 'high';
  format: 'jpeg' | 'png' | 'raw';
}

/** Photo capture metadata. */
export interface PhotoMetadata {
  timestamp: number;
  exposureTime: number;
  iso: number;
  fNumber: number;
  focalLength: number;
  flashUsed: boolean;
}

/** Video capture settings. */
export interface VideoSettings extends CaptureSettings {
  fps: 24 | 30 | 60;
  bitrate: 'low' | 'medium' | 'high';
  stabilization: boolean;
}

/** AR Tracking state. */
export interface ARTrackingState {
  isTracking: boolean;
  confidence: number; // 0-1
  planes: ARPlane[];
}

export interface ARPlane {
  id: string;
  type: 'horizontal' | 'vertical';
  center: { x: number; y: number; z: number };
  extent: { width: number; height: number };
}
