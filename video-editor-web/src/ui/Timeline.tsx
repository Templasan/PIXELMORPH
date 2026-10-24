import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { clipDurationMs, clipEndMs, type Clip, type Track } from '../domain/Track';
import { moveClip, rippleTrim, trimClipIn, trimClipOut } from '../domain/timeline';
import { formatTimecode } from '../domain/frameMath';
import type { EditorSession } from '../application/session';
import { useStore } from '../state/useStore';
import { Icon } from './Icon';
import { ClipStrip } from './ClipStrip';

const RULER_H = 24;
const ROW_H: Record<Track['kind'], number> = { video: 48, image: 40, text: 36, audio: 36 };
const MIN_PPS = 10;
const MAX_PPS = 600;
/** A drag shorter than this is a tap. */
const TAP_SLOP_PX = 6;
/** Clip edges and the playhead pull a dragged edge within this distance. */
const SNAP_PX = 8;

/** Rows top to bottom: texts, then media from the top layer down, then sound. */
export function displayOrder(tracks: readonly Track[]): Track[] {
  const media = tracks.filter((t) => t.kind === 'video' || t.kind === 'image');
  return [
    ...tracks.filter((t) => t.kind === 'text'),
    ...[...media].reverse(),
    ...tracks.filter((t) => t.kind === 'audio'),
  ];
}

function tickStepMs(pps: number): number {
  const steps = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];
  return steps.find((s) => (s / 1000) * pps >= 70) ?? 60000;
}

type Drag =
  | { kind: 'scrub'; x0: number; t0: number; moved: boolean }
  | { kind: 'move'; x0: number; t0: number; trackId: string; clip: Clip; moved: boolean; selected: boolean }
  | { kind: 'trim'; x0: number; trackId: string; clip: Clip; side: 'in' | 'out' }
  | { kind: 'pinch'; d0: number; pps0: number };

/**
 * The timeline. The playhead stays in the middle and the tracks move under it (as in mobile
 * editors): dragging the background scrubs, the playhead is always the time the player reports.
 */
export function Timeline({
  session,
  onTransition,
}: {
  session: EditorSession;
  onTransition: (clipId: string) => void;
}) {
  const { editor } = session;
  const tracks = useStore(editor.store, (s) => s.tracks);
  const selectedId = useStore(editor.store, (s) => s.selectedClipId);
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

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, e.clientX);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      editor.endGesture();
      drag.current = { kind: 'pinch', d0: Math.abs(a - b) || 1, pps0: ppsRef.current };
      return;
    }
    session.pause();
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-clip]');
    const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]');
    if (target) {
      const trackId = target.dataset.track!;
      const track = tracks.find((t) => t.id === trackId)!;
      const clip = track.clips.find((c) => c.id === target.dataset.clip)!;
      if (handle && !track.locked) {
        drag.current = { kind: 'trim', x0: e.clientX, trackId, clip, side: handle.dataset.handle as 'in' | 'out' };
        return;
      }
      drag.current = {
        kind: 'move',
        x0: e.clientX,
        t0: session.time.get(),
        trackId,
        clip,
        moved: false,
        selected: clip.id === editor.store.get().selectedClipId && !track.locked,
      };
      return;
    }
    drag.current = { kind: 'scrub', x0: e.clientX, t0: session.time.get(), moved: false };
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
    const dx = e.clientX - d.x0;
    const dms = (dx / ppsRef.current) * 1000;
    if (d.kind === 'scrub' || (d.kind === 'move' && !d.selected)) {
      // Dragging an unselected clip scrolls the timeline like the background does.
      if (Math.abs(dx) > TAP_SLOP_PX) d.moved = true;
      if (!d.moved) return;
      if (d.kind === 'move') drag.current = { kind: 'scrub', x0: d.x0, t0: d.t0, moved: true };
      session.seek(Math.max(0, Math.min(durationMs, d.t0 - dms)));
      return;
    }
    if (d.kind === 'move') {
      if (Math.abs(dx) > TAP_SLOP_PX) d.moved = true;
      if (!d.moved) return;
      const start = snap(d.clip.startMs + dms, d.clip.id);
      const end = snap(d.clip.startMs + clipDurationMs(d.clip) + dms, d.clip.id);
      // Whichever edge snapped decides; otherwise follow the finger.
      const desired =
        start !== d.clip.startMs + dms ? start : end - clipDurationMs(d.clip);
      editor.live((before) => moveClip(before, d.trackId, d.clip.id, desired));
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

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (pointers.current.size > 0) return;
    drag.current = null;
    if (!d) return;
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
      style={{ height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div ref={contentRef} className="content" style={{ width: contentWidth, height }}>
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
            style={{ position: 'absolute', top: rowTops[i], height: ROW_H[track.kind], width: contentWidth }}
          >
            {[...track.clips]
              .sort((a, b) => a.startMs - b.startMs)
              .map((clip, k, sorted) => {
                const left = (clip.startMs / 1000) * pps;
                const w = Math.max(4, (clipDurationMs(clip) / 1000) * pps);
                const selected = clip.id === selectedId;
                const prev = sorted[k - 1];
                const adjacent =
                  (track.kind === 'video' || track.kind === 'image') &&
                  prev &&
                  Math.abs(clipEndMs(prev) - clip.startMs) < 1;
                return (
                  <div key={clip.id}>
                    <div
                      data-clip={clip.id}
                      data-track={track.id}
                      className={`clip${selected ? ' selected' : ''}`}
                      style={{ left, width: w, background: clip.color }}
                    >
                      <ClipStrip
                        clip={clip}
                        kind={track.kind}
                        width={w}
                        height={ROW_H[track.kind] - 8}
                        pps={pps}
                        previews={session.previews}
                        root={rootEl}
                      />
                      {selected && !track.locked && (
                        <div data-handle="in" className="handle left">‹</div>
                      )}
                      <span style={{ marginLeft: selected ? 16 : 0 }}>
                        {clip.text ? clip.text.content : clip.name}
                      </span>
                      {(clip.speed ?? 1) !== 1 && <span className="meta"> {clip.speed}x</span>}
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
                        aria-label="Transição"
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
      <div className="track-headers">
        {rows.map((track) => (
          <div key={track.id} className="track-header" style={{ height: ROW_H[track.kind] }}>
            <span>{track.name}</span>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => editor.toggleVisible(track.id)}
              aria-label={track.visible ? 'Esconder faixa' : 'Mostrar faixa'}
            >
              {track.visible ? '●' : '○'}
            </button>
          </div>
        ))}
      </div>
      <div className="playhead" style={{ left: center }} />
      <div className="zoom-hint">
        <span ref={timeRef} hidden />
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setPps((p) => Math.max(MIN_PPS, p / 1.5))} aria-label="Diminuir zoom">−</button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setPps((p) => Math.min(MAX_PPS, p * 1.5))} aria-label="Aumentar zoom">+</button>
      </div>
    </div>
  );
}
