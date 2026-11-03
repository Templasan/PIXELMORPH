import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { clipDurationMs, clipEndMs, clipMedia, createTrackId, type Clip, type Track } from '../domain/Track';
import {
  addPictureTrack,
  moveClip,
  moveClipToTrack,
  rippleMove,
  rippleTrim,
  shiftTrack,
  trimClipIn,
  trimClipOut,
} from '../domain/timeline';
import { formatTimecode } from '../domain/frameMath';
import { displayOrder } from './trackOrder';
import type { EditorSession } from '../application/session';
import { useStore } from '../state/useStore';
import { Icon } from './Icon';
import { ClipStrip } from './ClipStrip';
import { t } from '../i18n';

const RULER_H = 24;
const ROW_H: Record<Track['kind'], number> = { video: 48, image: 48, text: 48, audio: 40 };
/** Past this share of the screen the tracks scroll instead of pushing the preview away. */
const MAX_HEIGHT_SHARE = 0.36;
/** Dragging a clip or an edge this close to a side scrolls the timeline (px from the edge). */
const EDGE_PX = 36;
/** Auto-scroll speed at the very edge, in timeline ms per second of holding. */
const EDGE_SPEED_MS = 2500;
const MIN_PPS = 10;
const MAX_PPS = 600;
/** A drag shorter than this is a tap. */
const TAP_SLOP_PX = 6;
/** Clip edges and the playhead pull a dragged edge within this distance. */
const SNAP_PX = 8;

function tickStepMs(pps: number): number {
  const steps = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];
  return steps.find((s) => (s / 1000) * pps >= 70) ?? 60000;
}

type Drag =
  | { kind: 'scrub'; x0: number; y0: number; t0: number; moved: boolean }
  | { kind: 'scroll'; y0: number; top0: number }
  | { kind: 'header'; y0: number; trackId: string; moved: boolean }
  | {
      kind: 'move';
      x0: number;
      y0: number;
      t0: number;
      trackId: string;
      clip: Clip;
      moved: boolean;
      selected: boolean;
      /** The track a drag above the top row creates (the same one for the whole drag). */
      newTrackId: string;
    }
  | { kind: 'trim'; x0: number; t0: number; trackId: string; clip: Clip; side: 'in' | 'out' }
  | { kind: 'pinch'; d0: number; pps0: number };

/**
 * The timeline. The playhead stays in the middle and the tracks move under it (as in mobile
 * editors): dragging the background scrubs, the playhead is always the time the player reports.
 */
export function Timeline({
  session,
  onTransition,
  onTrack,
}: {
  session: EditorSession;
  onTransition: (clipId: string) => void;
  onTrack: () => void;
}) {
  const { editor } = session;
  const tracks = useStore(editor.store, (s) => s.tracks);
  const selectedId = useStore(editor.store, (s) => s.selectedClipId);
  const activeTrackId = useStore(editor.store, (s) => s.activeTrackId);
  const [scrollTop, setScrollTop] = useState(0);
  const [pps, setPps] = useState(80); // pixels per second
  const [width, setWidth] = useState(360);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, number>());
  const ppsRef = useRef(pps);
  ppsRef.current = pps;

  const rows = useMemo(() => displayOrder(tracks), [tracks]);
  const durationMs = useMemo(() => session.durationMs(), [tracks, session]);
  const height = RULER_H + rows.reduce((h, t) => h + ROW_H[t.kind], 0);
  const center = width / 2;
  const viewHeight = Math.min(height, Math.max(RULER_H + 2 * ROW_H.video, window.innerHeight * MAX_HEIGHT_SHARE));
  const maxScroll = height - viewHeight;
  const top = Math.min(scrollTop, maxScroll);

  useLayoutEffect(() => {
    const el = rootRef.current!;
    setRootEl(el);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // The playhead time moves the tracks directly (no re-render per frame).
  useEffect(() => {
    const place = () => {
      const t = session.time.get();
      if (contentRef.current) {
        contentRef.current.style.transform = `translateX(${center - (t / 1000) * ppsRef.current}px)`;
      }
      if (timeRef.current) timeRef.current.textContent = formatTimecode(t);
    };
    place();
    return session.time.subscribe(place);
  }, [session, center, pps]);

  /** Snaps a timeline time to the playhead or a clip edge when it is close (in pixels). */
  const snap = (ms: number, ignoreId: string) => {
    const edges = [session.time.get(), 0];
    for (const t of tracks) {
      for (const c of t.clips) {
        if (c.id === ignoreId) continue;
        edges.push(c.startMs, clipEndMs(c));
      }
    }
    let best = ms;
    let bestPx = SNAP_PX;
    for (const e of edges) {
      const px = (Math.abs(e - ms) / 1000) * ppsRef.current;
      if (px < bestPx) {
        bestPx = px;
        best = e;
      }
    }
    return best;
  };

  /** The row under a screen height: its track, 'above' over the ruler, null past the last row. */
  const rowAt = (clientY: number): Track | 'above' | null => {
    const rect = rootRef.current!.getBoundingClientRect();
    let y = clientY - rect.top - RULER_H + top;
    if (clientY - rect.top < RULER_H) return 'above';
    for (const row of rows) {
      if (y < ROW_H[row.kind]) return row;
      y -= ROW_H[row.kind];
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      // On the timeline, not the clip: a clip changing track is a new element under the finger.
      rootRef.current!.setPointerCapture?.(e.pointerId);
    } catch {
      // not a live pointer (synthetic event): the drag still works without capture
    }
    pointers.current.set(e.pointerId, e.clientX);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      editor.endGesture();
      drag.current = { kind: 'pinch', d0: Math.abs(a - b) || 1, pps0: ppsRef.current };
      return;
    }
    session.pause();
    const header = (e.target as HTMLElement).closest<HTMLElement>('[data-header]');
    if (header) {
      drag.current = { kind: 'header', y0: e.clientY, trackId: header.dataset.header!, moved: false };
      return;
    }
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-clip]');
    const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]');
    if (target) {
      const trackId = target.dataset.track!;
      const track = tracks.find((t) => t.id === trackId)!;
      const clip = track.clips.find((c) => c.id === target.dataset.clip)!;
      if (handle && !track.locked) {
        drag.current = {
          kind: 'trim',
          x0: e.clientX,
          t0: session.time.get(),
          trackId,
          clip,
          side: handle.dataset.handle as 'in' | 'out',
        };
        return;
      }
      drag.current = {
        kind: 'move',
        x0: e.clientX,
        y0: e.clientY,
        newTrackId: createTrackId(),
        t0: session.time.get(),
        trackId,
        clip,
        moved: false,
        selected: clip.id === editor.store.get().selectedClipId && !track.locked,
      };
      return;
    }
    drag.current = { kind: 'scrub', x0: e.clientX, y0: e.clientY, t0: session.time.get(), moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientX);
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      setPps(Math.max(MIN_PPS, Math.min(MAX_PPS, d.pps0 * ((Math.abs(a - b) || 1) / d.d0))));
      return;
    }
    if (d.kind === 'scroll') {
      setScrollTop(Math.max(0, Math.min(maxScroll, d.top0 - (e.clientY - d.y0))));
      return;
    }
    if (d.kind === 'header') {
      const row = rowAt(e.clientY);
      if (Math.abs(e.clientY - d.y0) > TAP_SLOP_PX) d.moved = true;
      if (!d.moved || row === null) return;
      // The rows run top to bottom and the stack bottom to top, so a row up is a step up.
      const over = row === 'above' ? 0 : rows.indexOf(row);
      // Live edits start from the snapshot, so the steps count from where the track was there.
      editor.live((before) =>
        shiftTrack(before, d.trackId, displayOrder(before).findIndex((r) => r.id === d.trackId) - over)
      );
      return;
    }
    lastX.current = e.clientX;
    lastY.current = e.clientY;
    const dx = e.clientX - d.x0;
    const dms = (dx / ppsRef.current) * 1000;
    if (d.kind === 'scrub' || (d.kind === 'move' && !d.selected)) {
      // Mostly vertical, with rows out of sight: the rows scroll.
      const dy = e.clientY - d.y0;
      if (!d.moved && maxScroll > 0 && Math.abs(dy) > TAP_SLOP_PX && Math.abs(dy) > Math.abs(dx)) {
        drag.current = { kind: 'scroll', y0: e.clientY, top0: top };
        return;
      }
      // Dragging an unselected clip scrolls the timeline like the background does.
      if (Math.abs(dx) > TAP_SLOP_PX) d.moved = true;
      if (!d.moved) return;
      if (d.kind === 'move') drag.current = { kind: 'scrub', x0: d.x0, y0: d.y0, t0: d.t0, moved: true };
      session.seek(Math.max(0, Math.min(durationMs, d.t0 - dms)));
      return;
    }
    if (d.kind === 'move') {
      if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(e.clientY - d.y0) > TAP_SLOP_PX) d.moved = true;
      if (!d.moved) return;
    }
    applyEdit(e.clientX, e.clientY);
    startEdgeScroll();
  };

  /** Applies a move/trim drag for the finger at `clientX`, counting how far the view scrolled. */
  const applyEdit = (clientX: number, clientY: number) => {
    const d = drag.current;
    if (!d || (d.kind !== 'move' && d.kind !== 'trim')) return;
    const dms = ((clientX - d.x0) / ppsRef.current) * 1000 + (session.time.get() - d.t0);
    if (d.kind === 'move') {
      const start = snap(d.clip.startMs + dms, d.clip.id);
      const end = snap(d.clip.startMs + clipDurationMs(d.clip) + dms, d.clip.id);
      // Whichever edge snapped decides; otherwise follow the finger.
      const desired =
        start !== d.clip.startMs + dms ? start : end - clipDurationMs(d.clip);
      // Ripple on: dropping over other clips reorders them; off: the clip moves into free space.
      const reorder = editor.store.get().rippleMode;
      // Over another row the clip changes layer; above the top row it starts a new one.
      const row = rowAt(clientY);
      const sound = tracks.find((t) => t.id === d.trackId)?.kind === 'audio';
      editor.live((before) => {
        if (row === 'above' && !sound)
          return moveClipToTrack(addPictureTrack(before, d.newTrackId), d.trackId, d.newTrackId, d.clip.id, desired);
        if (row && row !== 'above' && row.id !== d.trackId && row.id !== d.newTrackId) {
          const moved = moveClipToTrack(before, d.trackId, row.id, d.clip.id, desired);
          if (moved !== before) return moved;
        }
        return (reorder ? rippleMove : moveClip)(before, d.trackId, d.clip.id, desired);
      });
      return;
    }
    // trim (with Ripple on, the clip keeps its start and the clips after it follow)
    const speed = d.clip.speed ?? 1;
    const ripple = editor.store.get().rippleMode;
    if (d.side === 'in') {
      const at = snap(d.clip.startMs + dms, d.clip.id);
      const inPoint = d.clip.inPointMs + (at - d.clip.startMs) * speed;
      editor.live((before) =>
        ripple
          ? rippleTrim(before, d.trackId, d.clip.id, 'in', inPoint)
          : trimClipIn(before, d.trackId, d.clip.id, inPoint)
      );
    } else {
      const at = snap(clipEndMs(d.clip) + dms, d.clip.id);
      const outPoint = d.clip.outPointMs + (at - clipEndMs(d.clip)) * speed;
      editor.live((before) =>
        ripple
          ? rippleTrim(before, d.trackId, d.clip.id, 'out', outPoint)
          : trimClipOut(before, d.trackId, d.clip.id, outPoint)
      );
    }
  };

  // Holding a dragged clip or edge near a side scrolls the timeline under it.
  const lastX = useRef(0);
  const lastY = useRef(0);
  const edgeRaf = useRef(0);
  const startEdgeScroll = () => {
    if (edgeRaf.current) return;
    let prev = performance.now();
    const step = (now: number) => {
      const d = drag.current;
      const rect = rootRef.current?.getBoundingClientRect();
      if (!d || (d.kind !== 'move' && d.kind !== 'trim') || !rect) {
        edgeRaf.current = 0;
        return;
      }
      const left = lastX.current - rect.left;
      const right = rect.right - lastX.current;
      const push = left < EDGE_PX ? -(1 - left / EDGE_PX) : right < EDGE_PX ? 1 - right / EDGE_PX : 0;
      if (push !== 0) {
        const t = session.time.get() + push * EDGE_SPEED_MS * ((now - prev) / 1000);
        session.seek(Math.max(0, Math.min(durationMs + 10_000, t)));
        applyEdit(lastX.current, lastY.current);
      }
      prev = now;
      edgeRaf.current = requestAnimationFrame(step);
    };
    edgeRaf.current = requestAnimationFrame(step);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (pointers.current.size > 0) return;
    drag.current = null;
    if (!d || d.kind === 'scroll') return;
    if (d.kind === 'header') {
      if (d.moved) editor.endGesture();
      else {
        editor.setActiveTrack(d.trackId);
        onTrack();
      }
      return;
    }
    if (d.kind === 'move' && !d.moved) {
      editor.toggleSelect(d.clip.id);
      return;
    }
    if (d.kind === 'scrub' && !d.moved) {
      editor.clearSelection();
      return;
    }
    editor.endGesture();
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setPps((p) => Math.max(MIN_PPS, Math.min(MAX_PPS, p * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
      return;
    }
    session.pause();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    session.seek(Math.max(0, Math.min(durationMs, session.time.get() + (delta / ppsRef.current) * 1000)));
  };

  const step = tickStepMs(pps);
  const ticks: number[] = [];
  for (let t = 0; t <= durationMs + step * 4; t += step) ticks.push(t);
  const contentWidth = ((durationMs + step * 4) / 1000) * pps;

  let y = RULER_H;
  const rowTops = rows.map((t) => {
    const top = y;
    y += ROW_H[t.kind];
    return top;
  });

  return (
    <div
      ref={rootRef}
      className="timeline"
      style={{ height: viewHeight, minHeight: viewHeight }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div ref={contentRef} className="content" style={{ width: contentWidth, height: viewHeight }}>
        <div className="ruler" style={{ width: contentWidth }}>
          {ticks.map((t) => (
            <div key={t} className="tick" style={{ left: (t / 1000) * pps }}>
              {t % 1000 === 0 ? `${Math.floor(t / 60000)}:${String(Math.floor(t / 1000) % 60).padStart(2, '0')}` : ''}
            </div>
          ))}
        </div>
        {rows.map((track, i) => (
          <div
            key={track.id}
            className={`track-row${track.visible ? '' : ' hidden-track'}`}
            style={{ position: 'absolute', top: rowTops[i] - top, height: ROW_H[track.kind], width: contentWidth }}
          >
            {[...track.clips]
              .sort((a, b) => a.startMs - b.startMs)
              .map((clip, k, sorted) => {
                const media = clipMedia(track, clip);
                const left = (clip.startMs / 1000) * pps;
                const w = Math.max(4, (clipDurationMs(clip) / 1000) * pps);
                const selected = clip.id === selectedId;
                const prev = sorted[k - 1];
                const adjacent =
                  (media === 'video' || media === 'image') &&
                  prev &&
                  !prev.text &&
                  Math.abs(clipEndMs(prev) - clip.startMs) < 1;
                return (
                  <div key={clip.id}>
                    <div
                      data-clip={clip.id}
                      data-track={track.id}
                      className={`clip${selected ? ' selected' : ''}`}
                      style={{ left, width: w, background: session.colorOf(media) }}
                    >
                      <div className="clip-body">
                        <ClipStrip
                          clip={clip}
                          kind={media}
                          width={w}
                          height={ROW_H[track.kind] - 8}
                          pps={pps}
                          previews={session.previews}
                          root={rootEl}
                        />
                        <span>{clip.text ? clip.text.content : clip.name}</span>
                        {(clip.speed ?? 1) !== 1 && <span className="meta"> {clip.speed}x</span>}
                      </div>
                      {selected && !track.locked && (
                        <div data-handle="in" className="handle left">‹</div>
                      )}
                      {selected && !track.locked && (
                        <div data-handle="out" className="handle right">›</div>
                      )}
                    </div>
                    {adjacent && (
                      <button
                        className={`transition-mark${clip.transitionIn ? ' on' : ''}`}
                        style={{ left }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onTransition(clip.id)}
                        aria-label={t('Transição')}
                      >
                        <Icon name="link" size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      <button
        className="track-add"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => editor.commit((before) => addPictureTrack(before))}
        aria-label={t('Nova faixa')}
      >
        <Icon name="plus" size={14} />
      </button>
      <div className="track-headers">
        <div style={{ transform: `translateY(${-top}px)` }}>
        {rows.map((track) => (
          <div
            key={track.id}
            data-header={track.id}
            className={`track-header${track.id === activeTrackId ? ' on' : ''}`}
            style={{ height: ROW_H[track.kind] }}
          >
            <span>{track.name}</span>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => editor.toggleVisible(track.id)}
              aria-label={track.visible ? t('Esconder faixa') : t('Mostrar faixa')}
            >
              {track.visible ? '●' : '○'}
            </button>
          </div>
        ))}
        </div>
      </div>
      <div className="playhead" style={{ left: center }} />
      <div className="zoom-hint">
        <span ref={timeRef} hidden />
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setPps((p) => Math.max(MIN_PPS, p / 1.5))} aria-label={t('Diminuir zoom')}>−</button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setPps((p) => Math.min(MAX_PPS, p * 1.5))} aria-label={t('Aumentar zoom')}>+</button>
      </div>
    </div>
  );
}
