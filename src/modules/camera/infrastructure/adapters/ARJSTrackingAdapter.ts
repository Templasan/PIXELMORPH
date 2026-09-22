import { ARTrackingPort } from '../../ports';
import { ARTrackingState } from '../../domain';

/** Adapter for AR.js plane tracking. ponytail: stub, experimental. */
export class ARJSTrackingAdapter implements ARTrackingPort {
  async startTracking(): Promise<void> {
    console.warn('[AR.js] startTracking');
    // TODO: Initialize AR.js tracking
  }

  async stopTracking(): Promise<void> {
    console.warn('[AR.js] stopTracking');
  }

  async getTrackingState(): Promise<ARTrackingState> {
    console.warn('[AR.js] getTrackingState');
    return {
      isTracking: false,
      confidence: 0,
      planes: [],
    };
  }
}
