import { AudioRecordingSettings, AudioPlaybackSettings, AudioMetadata } from '../domain';

/** Abstraction for audio recording. */
export interface AudioRecordingPort {
  startRecording(settings: AudioRecordingSettings): Promise<void>;
  stopRecording(): Promise<{ uri: string; metadata: AudioMetadata }>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
}

/** Abstraction for audio playback. */
export interface AudioPlaybackPort {
  play(audioUri: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setSettings(settings: AudioPlaybackSettings): Promise<void>;
}

/** Abstraction for audio processing. */
export interface AudioProcessingPort {
  trim(audioUri: string, startMs: number, endMs: number, outputPath: string): Promise<void>;
  merge(audioUris: string[], outputPath: string): Promise<void>;
  normalize(audioUri: string, outputPath: string): Promise<void>;
}

/** Audio module errors. */
export class AudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioError';
  }
}

export class AudioRecordingError extends AudioError {
  constructor(message: string) {
    super(`Recording error: ${message}`);
    this.name = 'AudioRecordingError';
  }
}
