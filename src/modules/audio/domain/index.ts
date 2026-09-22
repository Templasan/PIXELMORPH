/** Audio recording settings. */
export interface AudioRecordingSettings {
  sampleRate: 16000 | 44100 | 48000;
  channels: 1 | 2;
  bitrate: 'low' | 'medium' | 'high';
  format: 'aac' | 'mp3' | 'wav';
}

/** Audio playback settings. */
export interface AudioPlaybackSettings {
  volume: number; // 0-1
  rate: number; // 0.5-2.0
  muted: boolean;
}

/** Audio metadata. */
export interface AudioMetadata {
  durationMs: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
  format: string;
}
