import { createStore } from '@core/state';

export interface EngineExportPreset {
  width: number;
  height: number;
  bitrate: number;
  /** An animated GIF of this size instead of an mp4. */
  gif?: { fps: number; maxColors: number };
}

export interface EngineExportRequest extends EngineExportPreset {
  id: number;
}

export interface EngineExportResult {
  uri: string;
  sizeBytes: number;
  durationMs: number;
  frameCount?: number;
  truncated?: boolean;
}

/**
 * What the export sheet asked the web engine to do. EnginePreview (which owns the engine) carries
 * the request out and settles it; the sheet just awaits `exportWithEngine`.
 */
export const engineExport = createStore<{ request: EngineExportRequest | null; cancelId: number }>({
  request: null,
  cancelId: 0,
});

interface Pending {
  id: number;
  resolve: (result: EngineExportResult) => void;
  reject: (error: Error) => void;
  onProgress: (pct: number) => void;
}

let pending: Pending | null = null;
let nextId = 1;

/** Exports the timeline through the web engine. Rejects with message 'CANCELLED' on cancel. */
export function exportWithEngine(
  preset: EngineExportPreset,
  onProgress: (pct: number) => void
): Promise<EngineExportResult> {
  pending?.reject(new Error('CANCELLED'));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending = { id, resolve, reject, onProgress };
    engineExport.set((s) => ({ ...s, request: { id, ...preset } }));
  });
}

export function cancelEngineExport(): void {
  if (pending) engineExport.set((s) => ({ ...s, cancelId: s.cancelId + 1 }));
}

/** EnginePreview reports progress (0..100) of request `id`. */
export function reportEngineExportProgress(id: number, pct: number): void {
  if (pending?.id === id) pending.onProgress(pct);
}

/** EnginePreview settles request `id` with the finished file or an error message. */
export function settleEngineExport(
  id: number,
  outcome: { result: EngineExportResult } | { error: string }
): void {
  if (pending?.id !== id) return;
  const p = pending;
  pending = null;
  engineExport.set((s) => ({ ...s, request: null }));
  if ('result' in outcome) p.resolve(outcome.result);
  else p.reject(new Error(outcome.error));
}
