import type { Adjustments } from '../domain/adjustments';
import type { EditorLayer } from '../domain/layers';

/** One undo step: an adjustment field and its values before/after (the app's history format). */
export interface HistoryOp {
  id: string;
  type: string;
  params: { from: unknown; to: unknown };
  timestamp: number;
}

/** Undo log, oldest first (`undone`: the redo stack, next redo last). */
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

/** Saved adjustments shared by every photo (the app's presets). */
export interface PresetRef {
  id: string;
  name: string;
  adjustments: Record<string, number>;
}

/** Where a file's bytes go, written in order; `finish` says what became of it. */
export interface Sink<T> {
  start(fileName: string): Promise<void>;
  write(position: number, bytes: Uint8Array): Promise<void>;
  finish(): Promise<T>;
}

/** An export: `finish` returns where the file ended up (shown to the user). */
export type ExportSink = Sink<string>;

/** The project's photo after a bake: the new file and its light copy. */
export type BakedPhoto = Pick<SavedPhoto, 'photo' | 'previewUri'>;

/**
 * Everything the editor needs from outside (port). The Android app implements it on top of its
 * projects, gallery and file system; the browser dev host on a local folder.
 */
export interface EditorHost {
  loadProject(): Promise<SavedPhoto | null>;
  saveProject(project: SavedPhoto): Promise<void>;
  /** A second picture from the gallery (double exposure, overlay); null when cancelled. */
  pickPicture(): Promise<PictureRef | null>;
  listPresets(): Promise<PresetRef[]>;
  /** The other photo projects (batch edit). */
  listPhotoProjects(): Promise<{ id: string; name: string }[]>;
  /** Applies `look` to those projects as one undo step each; returns how many. */
  applyLookTo(ids: string[], look: Record<string, number>): Promise<number>;
  savePreset(name: string, adjustments: Record<string, number>): Promise<void>;
  exportSink(): ExportSink;
  /** A picture made here (collage, panorama) becomes a new photo project, which the host opens. */
  newProject(name: string, width: number, height: number): Sink<void>;
  /** A baked version of the photo (adjustments made pixels) becomes the project's photo. */
  photoSink(): Sink<BakedPhoto>;
  /** Leave the editor (the app goes back to its projects). */
  close(): void;
}
