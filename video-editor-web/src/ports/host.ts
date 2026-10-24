import type { Track } from '../domain/Track';
import type { FileReader } from '../engine/media';

/** A file the user can put on the timeline. */
export interface MediaItem {
  name: string;
  /** A URL the editor's page can read (the app maps device files to one). */
  uri: string;
  kind: 'video' | 'image' | 'audio';
}

export type ProjectFormat = '16:9' | '9:16' | '1:1' | '4:3';

export interface SavedProject {
  name: string;
  tracks: Track[];
  format?: ProjectFormat;
}

/** Where an export's bytes go, written in order (mp4 chunks may rewrite earlier positions). */
export interface ExportSink {
  start(fileName: string): Promise<void>;
  write(position: number, bytes: Uint8Array): Promise<void>;
  /** Returns where the file ended up (shown to the user). */
  finish(): Promise<string>;
}

/**
 * Everything the editor needs from outside (port). The Android app implements it on top of its
 * projects, gallery, proxies and file system; the browser dev host on a local folder.
 */
export interface EditorHost {
  /** Media the user picks to add (the app opens its picker; dev lists media/). */
  pickMedia(kind: MediaItem['kind']): Promise<MediaItem[]>;
  /** True when pickMedia already IS the user's choice (a system picker): add without a list. */
  pickIsFinal: boolean;
  loadProject(): Promise<SavedProject | null>;
  saveProject(project: SavedProject): Promise<void>;
  exportSink(): ExportSink;
  /** For files too large to read whole by URL; null: always read by URL. */
  fileReader: FileReader | null;
  streamAboveBytes: number;
  /** Leave the editor (the app goes back to its projects). */
  close(): void;
  /**
   * Lighter copies for the PREVIEW (the export always reads the originals): the editor says which
   * video files it shows; the host answers, now and whenever more are ready, with
   * original → copy. Hosts without copies leave these out.
   */
  wantPreviewSources?(uris: string[]): void;
  onPreviewSources?(listener: (map: Record<string, string>) => void): void;
}
