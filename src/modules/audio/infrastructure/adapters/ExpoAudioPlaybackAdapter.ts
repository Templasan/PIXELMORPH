import { AudioPlaybackPort } from '../../ports';
import { AudioPlaybackSettings } from '../../domain';

/** Adapter for expo-audio playback. ponytail: stub until integration. */
export class ExpoAudioPlaybackAdapter implements AudioPlaybackPort {
  async play(_audioUri: string): Promise<void> {
    console.warn('[ExpoAudio] play');
    // TODO: Use expo-audio to play
  }

  async pause(): Promise<void> {
    console.warn('[ExpoAudio] pause');
  }

  async resume(): Promise<void> {
    console.warn('[ExpoAudio] resume');
  }

  async stop(): Promise<void> {
    console.warn('[ExpoAudio] stop');
  }

  async seek(_positionMs: number): Promise<void> {
    console.warn('[ExpoAudio] seek');
  }

  async setSettings(_settings: AudioPlaybackSettings): Promise<void> {
    console.warn('[ExpoAudio] setSettings');
  }
}
