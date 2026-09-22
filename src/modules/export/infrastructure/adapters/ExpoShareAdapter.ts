import { SharePort } from '../../ports';

/** Adapter for share functionality using expo-sharing. ponytail: stub until integration. */
export class ExpoShareAdapter implements SharePort {
  async shareImage(_imageUri: string): Promise<void> {
    console.warn('[Expo] Share image');
    // TODO: Use expo-sharing
  }

  async shareVideo(_videoUri: string): Promise<void> {
    console.warn('[Expo] Share video');
    // TODO: Use expo-sharing
  }
}
