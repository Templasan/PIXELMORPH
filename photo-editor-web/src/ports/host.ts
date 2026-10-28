import type { Adjustments } from '../domain/adjustments';
import type { EditorLayer } from '../domain/layers';

/** One undo step: an adjustment field and its values before/after (the app's history format). */
export interface HistoryOp {
  type: string;
  params: { from: unknown; to: unknown };
}

export interface SavedHistory {
  done: HistoryOp[];
  undone: HistoryOp[];
}

/** A picture file the page can read by URL (the app maps device files to one). */
export interface PictureRef {
  name: string;
  uri: string;
}

export interface SavedPhoto {
  name: string;
  /** The photo being edited, at full resolution (the export reads it). */
  photo: PictureRef & { format?: string; sizeBytes?: number; width?: number; height?: number };
  /** A lighter copy for the screen; without one the editor makes its own. */
  previewUri?: string;
  adjustments?: Partial<Adjustments>;
  layers?: EditorLayer[];
  doubleExposure?: PictureRef | null;
  overlay?: PictureRef | null;
  frameColor?: string;
  frameGradientColor?: string;
  history?: SavedHistory;
}

/** Where an export's bytes go, written in order. */
export interface ExportSink {
  start(fileName: string): Promise<void>;
  write(position: number, bytes: Uint8Array): Promise<void>;
  /** Returns where the file ended up (shown to the user). */
  finish(): Promise<string>;
}

/**
 * Everything the editor needs from outside (port). The Android app implements it on top of its
 * projects, gallery and file system; the browser dev host on a local folder.
 */
export interface EditorHost {
  loadProject(): Promise<SavedPhoto | null>;
  saveProject(project: SavedPhoto): Promise<void>;
  /** A second picture from the gallery (double exposure, overlay); null when cancelled. */
  pickPicture(): Promise<PictureRef | null>;
  exportSink(): ExportSink;
  /** Leave the editor (the app goes back to its projects). */
  close(): void;
}
