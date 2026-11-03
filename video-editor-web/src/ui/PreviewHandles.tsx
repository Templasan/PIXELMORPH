import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { EditorSession } from '../application/session';
import { selectedClipOf } from '../application/videoEditorStore';
import { clipDurationMs, type Clip } from '../domain/Track';
import { MAX_TEXT_SIZE, MIN_TEXT_SIZE } from '../domain/textCaption';
import { useStore } from '../state/useStore';
import { t } from '../i18n';

const MIN_WINDOW = 0.05;
const MAX_WINDOW = 3;
/** Turning this close to a right angle lands on it. */
const ROTATE_SNAP_DEG = 4;

interface Grab {
  id: number;
  mode: 'move' | 'scale' | 'rotate';
  clip: Clip;
  x0: number;
  y0: number;
  /** The clip's box when grabbed, in fractions of the frame. */
  box: { x: number; y: number; w: number; h: number; aspect: number };
  /** The finger's distance from the box's centre when grabbed, in screen px. */
  reach: number;
}

/**
 * The selected clip's box over the preview: drag it to move, the corner to resize, the knob above
 * it to turn. A clip that
 * fills the frame becomes a window the moment it is dragged. One undo step per gesture.
 */
export function PreviewHandles({
  session,
  canvasRef,
}: {
  session: EditorSession;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const { editor } = session;
  const selection = useStore(editor.store, (s) => selectedClipOf(s));
  const time = useStore(session.time);
  useStore(session.drawn);
  const grab = useRef<Grab | null>(null);
  const canvas = canvasRef.current;
  if (!selection || !canvas || !canvas.width) return null;
  const { track, clip } = selection;
  const box = session.boxOf(clip.id);
  const showing = time >= clip.startMs && time < clip.startMs + clipDurationMs(clip);
  if (track.kind === 'audio' || track.locked || !track.visible || !box || !showing) return null;

  // The canvas fits inside its box keeping its shape (object-fit: contain).
  const k = Math.min(canvas.clientWidth / canvas.width, canvas.clientHeight / canvas.height);
  const shownW = canvas.width * k;
  const shownH = canvas.height * k;
  const left = (canvas.clientWidth - shownW) / 2;
  const top = (canvas.clientHeight - shownH) / 2;

  const begin = (e: ReactPointerEvent, mode: Grab['mode']) => {
    e.stopPropagation();
    if (grab.current) return;
    // Edits restart the sound, and a clip ending under the finger would lose the gesture.
    session.pause();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.closest('.clip-box')!.getBoundingClientRect();
    grab.current = {
      id: e.pointerId,
      mode,
      clip,
      x0: e.clientX,
      y0: e.clientY,
      box: { x: box.x / canvas.width, y: box.y / canvas.height, w: box.w / canvas.width, h: box.h / canvas.height, aspect: box.aspect ?? 1 },
      reach: Math.max(1, Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))),
    };
  };
  const move = (e: ReactPointerEvent) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    e.stopPropagation();
    const r = e.currentTarget.closest('.clip-box')!.getBoundingClientRect();
    const dx = (e.clientX - g.x0) / shownW;
    const dy = (e.clientY - g.y0) / shownH;
    const cx = g.box.x + g.box.w / 2;
    const cy = g.box.y + g.box.h / 2;
    if (g.mode === 'rotate') {
      const mx = r.left + r.width / 2;
      const my = r.top + r.height / 2;
      const base = (g.clip.text ? g.clip.text.rotation : g.clip.rotation) ?? 0;
      const turned = base + ((Math.atan2(e.clientY - my, e.clientX - mx) - Math.atan2(g.y0 - my, g.x0 - mx)) * 180) / Math.PI;
      const normal = ((turned % 360) + 360) % 360;
      const right = Math.round(normal / 90) * 90;
      const rotation = Math.abs(normal - right) < ROTATE_SNAP_DEG ? right % 360 : normal;
      editor.liveClip((c) => (c.text ? { ...c, text: { ...c.text, rotation } } : { ...c, rotation }));
      return;
    }
    if (g.clip.text) {
      const text = g.clip.text;
      if (g.mode === 'move') {
        const x = Math.max(0, Math.min(1, text.x + dx));
        const y = Math.max(0, Math.min(1, text.y + dy));
        editor.liveClip((c) => ({ ...c, text: { ...c.text!, x, y } }));
      } else {
        const factor = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / g.reach;
        const size = Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, text.size * factor));
        editor.liveClip((c) => ({ ...c, text: { ...c.text!, size } }));
      }
      return;
    }
    // A window keeps the picture's shape, so its width and top-left corner say it all.
    const factor =
      g.mode === 'scale'
        ? Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / g.reach
        : 1;
    const w = Math.max(MIN_WINDOW, Math.min(MAX_WINDOW, g.box.w * factor));
    // In frame heights: the picture's own shape, and a frame that may not be square.
    const h = g.box.aspect * w * (canvas.width / canvas.height);
    // The centre stays on the frame, so a clip can always be grabbed again.
    const nx = g.mode === 'move' ? Math.max(0, Math.min(1, cx + dx)) : cx;
    const ny = g.mode === 'move' ? Math.max(0, Math.min(1, cy + dy)) : cy;
    editor.liveClip((c) => ({
      ...c,
      pipPosition: { x: nx - w / 2, y: ny - h / 2 },
      pipSize: { width: w, height: w },
    }));
  };
  const end = (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (grab.current?.id !== e.pointerId) return;
    grab.current = null;
    editor.endGesture();
  };
  const handlers = {
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  };
  return (
    <div
      className="clip-box"
      style={{
        left: left + box.x * k,
        top: top + box.y * k,
        width: box.w * k,
        height: box.h * k,
        transform: `rotate(${box.rotation}deg)`,
      }}
      onPointerDown={(e) => begin(e, 'move')}
      {...handlers}
    >
      <div className="clip-knob" aria-label={t('Redimensionar')} onPointerDown={(e) => begin(e, 'scale')} {...handlers} />
      <div className="clip-knob rotate" aria-label={t('Girar')} onPointerDown={(e) => begin(e, 'rotate')} {...handlers} />
    </div>
  );
}
