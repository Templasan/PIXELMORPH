import { createOperation, type Operation } from '@core/history';
import { DEFAULT_ADJUSTMENTS } from '@modules/photo-editor/domain/adjustments';

/** photo-editor-web's preset step: several fields in one undo entry (application/photoEditorStore.ts). */
export const PRESET_OP = 'preset';

/**
 * US-02 batch edit: the undo step that applies `look` to a photo whose log is `past`. `from` holds
 * the values the photo has now (its log replayed, as the web editor does on open), so undoing it
 * there brings the photo back exactly.
 */
export function presetStep(past: readonly Operation[], look: Record<string, number>): Operation {
  const now: Record<string, unknown> = { ...DEFAULT_ADJUSTMENTS };
  for (const op of past) {
    if (op.type === PRESET_OP) Object.assign(now, op.params.to);
    else if (op.type in now) now[op.type] = op.params.to;
  }
  const from: Record<string, unknown> = {};
  for (const k of Object.keys(look)) from[k] = now[k];
  return createOperation(PRESET_OP, from, look);
}
