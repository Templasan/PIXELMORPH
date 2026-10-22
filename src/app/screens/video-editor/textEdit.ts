/**
 * Pure helpers of the text-over-video editing UI (RF-008): no RN, Skia or DOM imports, so Jest
 * can test them directly.
 */
import { createClip, type Clip } from '@modules/video-editor/domain/Track';
import {
  DEFAULT_TEXT,
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  type ClipText,
} from '@modules/video-editor/domain/textCaption';

/** A new text clip lasts this long on the timeline. */
export const TEXT_CLIP_MS = 3000;
/** The scene is 16:9 at every preview tier and in the export. */
export const SCENE_ASPECT = 16 / 9;

/** A text clip placed at the playhead, with the default look. */
export function createTextClip(color: string): Clip {
  return {
    ...createClip({
      name: 'Texto',
      sourceUri: '',
      color,
      startMs: 0,
      sourceDurationMs: TEXT_CLIP_MS,
      outPointMs: TEXT_CLIP_MS,
    }),
    text: { ...DEFAULT_TEXT },
  };
}

/** The clip label on the timeline: the content, one line, at most 20 characters. */
export function captionName(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 20) || 'Texto';
}

/**
 * Where the preview draws the frame: full panel width, height from the 16:9 scene, centred
 * vertically (the engine's canvas works the same way, so it may overflow a short panel).
 */
export function videoFrameRect(panel: { width: number; height: number }) {
  const height = panel.width / SCENE_ASPECT;
  return { left: 0, top: (panel.height - height) / 2, width: panel.width, height };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** New centre after a drag of (dx, dy) frame widths/heights from where the drag started. */
export function movedCentre(start: Pick<ClipText, 'x' | 'y'>, dx: number, dy: number) {
  return { x: clamp(start.x + dx, 0, 1), y: clamp(start.y + dy, 0, 1) };
}

/** Line height after a pinch of `scale` from where it started, clamped to the allowed sizes. */
export function pinchedSize(startSize: number, scale: number): number {
  return clamp(startSize * scale, MIN_TEXT_SIZE, MAX_TEXT_SIZE);
}
