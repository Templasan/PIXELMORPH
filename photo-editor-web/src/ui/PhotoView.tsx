import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import type { PhotoSession } from '../application/session';
import { perspectiveCornersOf, type Adjustments as Adj } from '../domain/adjustments';
import { snapToGuides, type SnapTargets } from '../domain/geometry/snapGuides';
import { elementOf, patchElement, scaleElement, type EditorLayer } from '../domain/layers';
import { layerBox } from '../engine/scene';
import { useStore } from '../state/useStore';
import { t } from '../i18n';

/** What the canvas does with a finger right now (set by the open tool). */
export type ViewMode = 'none' | 'perspective' | 'light';

type Pt = { x: number; y: number };
const MIN_ZOOM = 100;
const MAX_ZOOM = 800;
/** A finger may drift this far (px) and still be a tap. */
const SLOP = 12;
/** A tap lasts less than this (ms). */
const HOLD_MS = 400;
/** A second tap within this (ms) makes a double tap. */
const DOUBLE_MS = 350;

/**
 * The picture, fitted to the space it gets, zoomed and panned. Over it: painting (Camadas with a
 * paint layer), the drag handles of the open tool and the compare divider. Every position is
 * handed to the session in scene units.
 *
 * Touch on the photo: pinch zooms (centred on the fingers), one or two fingers pan when zoomed
 * (one finger is left to a tool that uses it), taps are shortcuts (2 = undo, 3 = redo, 2 double =
 * export, 3 double = next tool), a one-finger double tap toggles 100% / 200%. Ctrl+wheel zooms.
 */
export function PhotoView({
  session,
  mode,
  onExport,
  onNextTool,
}: {
  session: PhotoSession;
  mode: ViewMode;
  onExport: () => void;
  onNextTool: () => void;
}) {
  const { editor } = session;
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const info = useStore(session.info);
  const st = useStore(editor.store);
  const size = info.size && session.size();
  const selected = st.layers.find((l) => l.id === st.selectedLayerId);
  const local = st.activeTool === 'mascaras' && selected?.local && !selected.locked ? selected.local : null;
  const painting =
    (st.activeTool === 'camadas' && selected?.kind === 'paint' && !selected.locked) || local?.mask === 'brush';
  const movable =
    (st.activeTool === 'elementos' || st.activeTool === 'camadas') &&
    !!selected &&
    selected.visible &&
    !selected.locked &&
    !!elementOf(selected);
  // A tool that takes one finger (painting, compare divider, a handle) keeps one-finger drags.
  const oneFingerTool = painting || st.compareMode || mode !== 'none' || movable || !!local;

  useLayoutEffect(() => {
    const el = boxRef.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the picture in the box; the canvas has the screen's real pixels.
  const zoom = st.zoom / 100;
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 });
  const panRef = useRef<Pt>(pan);
  // Pointers on the photo now (client px), where each began, and the gesture's start values.
  const touches = useRef(new Map<number, { x: number; y: number; sx: number; sy: number }>());
  const gesture = useRef<{ max: number; moved: boolean; t0: number; at: Pt } | null>(null);
  const base = useRef<{ z0: number; pan0: Pt; c0: Pt; d0: number } | null>(null);
  const pendingTap = useRef<{ n: number; t: number; timer: number } | null>(null);
  const fit = size ? Math.min(box.w / size.scene.w, box.h / size.scene.h) * zoom : 0;
  const cssW = size ? Math.max(1, Math.floor(size.scene.w * fit)) : 0;
  const cssH = size ? Math.max(1, Math.floor(size.scene.h * fit)) : 0;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cssW) return;
    // Zoomed past the light copy there is no more detail to show: the canvas stops growing there
    // (an 800% zoom at 3x density would otherwise ask for a 70 MP canvas).
    const k = Math.min(window.devicePixelRatio || 1, session.pixelsPerUnit() / (cssW / size!.scene.w));
    canvas.width = Math.round(cssW * k);
    canvas.height = Math.round(cssH * k);
    session.attach(canvas);
    return () => session.detach(canvas);
  }, [session, cssW, cssH]);

  // ---- zoom, pan and touch shortcuts (pointer events on the view box; handles stop their own) ----
  const rel = (x: number, y: number): Pt => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
  };
  const pts = () => [...touches.current.values()];
  const centre = (): Pt => {
    const ps = pts();
    return rel(
      ps.reduce((s, p) => s + p.x, 0) / ps.length,
      ps.reduce((s, p) => s + p.y, 0) / ps.length
    );
  };
  const spread = () => {
    const [a, b] = pts();
    return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  /** Zoom z0 -> z1 keeps the picture point under c0 under c1 (the centre of the box is 0,0). */
  const zoomPan = (z0: number, p0: Pt, c0: Pt, z1: number, c1: Pt): Pt => ({
    x: c1.x - ((c0.x - p0.x) / z0) * z1,
    y: c1.y - ((c0.y - p0.y) / z0) * z1,
  });
  // The picture may not leave the box's edges: pan is limited to what the zoom overflows.
  const clampPan = (z: number, p: Pt): Pt => {
    if (!size) return p;
    const f = (Math.min(box.w / size.scene.w, box.h / size.scene.h) * z) / 100;
    const mx = Math.max(0, (size.scene.w * f - box.w) / 2);
    const my = Math.max(0, (size.scene.h * f - box.h) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };
  const setView = (z: number, p: Pt) => {
    const zz = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)));
    const cp = clampPan(zz, p);
    editor.setZoom(zz);
    panRef.current = cp;
    setPan(cp);
  };
  const rebase = () => {
    base.current = { z0: editor.store.get().zoom, pan0: panRef.current, c0: centre(), d0: spread() };
  };
  const shortcut = (n: number) => {
    if (n === 2) editor.undo();
    else if (n === 3) editor.redo();
  };
  // A single tap waits DOUBLE_MS for a second one, so a double tap does not also undo or redo.
  const onTap = (n: number, at: Pt) => {
    const p = pendingTap.current;
    pendingTap.current = null;
    if (p) clearTimeout(p.timer);
    if (p && p.n === n && performance.now() - p.t < DOUBLE_MS) {
      if (n === 1) {
        const z = editor.store.get().zoom;
        const z1 = z === 100 ? 200 : 100;
        setView(z1, zoomPan(z, panRef.current, at, z1, at));
      } else if (n === 2) onExport();
      else if (n === 3) onNextTool();
      return;
    }
    if (p) shortcut(p.n);
    pendingTap.current = {
      n,
      t: performance.now(),
      timer: window.setTimeout(() => {
        pendingTap.current = null;
        shortcut(n);
      }, DOUBLE_MS),
    };
  };
  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as Element).closest('.handle, .gizmo') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (touches.current.size === 0)
      gesture.current = { max: 0, moved: false, t0: performance.now(), at: rel(e.clientX, e.clientY) };
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    gesture.current!.max = Math.max(gesture.current!.max, touches.current.size);
    rebase();
  };
  const onMove = (e: ReactPointerEvent) => {
    const t = touches.current.get(e.pointerId);
    if (!t) return;
    t.x = e.clientX;
    t.y = e.clientY;
    if (Math.hypot(t.x - t.sx, t.y - t.sy) > SLOP) gesture.current!.moved = true;
    const b = base.current;
    const n = touches.current.size;
    if (!b || (n === 1 && oneFingerTool)) return;
    const z = n >= 2 && b.d0 > 0 ? (b.z0 * spread()) / b.d0 : b.z0;
    setView(z, zoomPan(b.z0, b.pan0, b.c0, z, centre()));
  };
  const onUp = (e: ReactPointerEvent, cancel = false) => {
    if (!touches.current.delete(e.pointerId)) return;
    if (touches.current.size > 0) {
      rebase();
      return;
    }
    const g = gesture.current!;
    gesture.current = null;
    base.current = null;
    if (!cancel && !g.moved && performance.now() - g.t0 < HOLD_MS) onTap(g.max, g.at);
  };
  // Ctrl+wheel zooms at the cursor; a native listener, so the page's own zoom can be stopped.
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e) => {
    if (!size) return;
    const z0 = editor.store.get().zoom;
    const z1 = z0 * Math.exp(-e.deltaY * 0.002);
    const c = rel(e.clientX, e.clientY);
    setView(z1, zoomPan(z0, panRef.current, c, z1, c));
  };
  useEffect(() => {
    const el = boxRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (info.status === 'error' || !size)
    return (
      <div className="view-box" ref={boxRef}>
        {info.status === 'error' ? <div className="toast">{info.error}</div> : <div className="muted">{t('Abrindo a foto…')}</div>}
      </div>
    );

  const { w: sw, h: sh } = size.scene;
  const toScene = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * sw, y: ((e.clientY - r.top) / r.height) * sh };
  };
  const a = st.adjustments;

  // A second finger means a pinch or a tap shortcut, not paint.
  const paint = {
    onPointerDown(e: ReactPointerEvent) {
      if (!painting || touches.current.size > 1) return;
      (e.target as Element).setPointerCapture(e.pointerId);
      const p = toScene(e);
      editor.appendStrokePoint(p.x, p.y, e.pointerType === 'pen' ? e.pressure : undefined);
    },
    onPointerMove(e: ReactPointerEvent) {
      if (!painting || !(e.buttons & 1) || touches.current.size > 1) return;
      const p = toScene(e);
      editor.appendStrokePoint(p.x, p.y, e.pointerType === 'pen' ? e.pressure : undefined);
    },
    onPointerUp() {
      if (painting) editor.commitStroke();
    },
  };

  // Other layers' centres and edges are snap targets for the one being moved (RF-067).
  const targets: SnapTargets = { x: [], y: [] };
  for (const l of st.layers) {
    if (l.id === st.selectedLayerId || !l.visible) continue;
    if (l.text || l.image) {
      const el = (l.text ?? l.image)!;
      targets.x.push(el.x);
      targets.y.push(el.y);
    } else if (l.shape) {
      const hw = l.shape.size;
      const hh = (l.shape.size * sw) / sh;
      targets.x.push(l.shape.x, l.shape.x - hw, l.shape.x + hw);
      targets.y.push(l.shape.y);
      if (l.shape.kind !== 'line' && l.shape.kind !== 'arrow') targets.y.push(l.shape.y - hh, l.shape.y + hh);
    }
  }

  const handles: ReactElement[] = [];
  if (mode === 'perspective') {
    const corners = perspectiveCornersOf(a, size.photo.w, size.photo.h);
    corners.forEach((c, i) => {
      // Corners live on the photo's rect; the scene adds the photo's turn about the centre.
      const p = photoToScene(c, size, a);
      handles.push(
        <Handle
          key={`p${i}`}
          x={p.x / sw}
          y={p.y / sh}
          onMove={(nx, ny) => {
            const q = sceneToPhoto({ x: nx * sw, y: ny * sh }, size, a);
            editor.setFields({ [`perspX${i}`]: q.x / size.photo.w, [`perspY${i}`]: q.y / size.photo.h });
          }}
          onEnd={(from) => {
            const now = editor.store.get().adjustments;
            editor.commitField(`perspX${i}`, now[`perspX${i}`], from[`perspX${i}`]);
            editor.commitField(`perspY${i}`, now[`perspY${i}`], from[`perspY${i}`]);
          }}
          adjustments={() => editor.store.get().adjustments}
        />
      );
    });
  } else if (mode === 'light') {
    handles.push(
      <Handle
        key="light"
        x={a.lightX}
        y={a.lightY}
        onMove={(nx, ny) => editor.setFields({ lightX: nx, lightY: ny })}
        onEnd={(from) => {
          const now = editor.store.get().adjustments;
          editor.commitField('lightX', now.lightX, from.lightX);
          editor.commitField('lightY', now.lightY, from.lightY);
        }}
        adjustments={() => editor.store.get().adjustments}
      />
    );
  } else if (local && local.mask !== 'brush') {
    // The picked colour, the centre, or a point on the gradient's line.
    handles.push(
      <Handle
        key={selected!.id}
        x={local.x}
        y={local.y}
        onMove={(nx, ny) =>
          editor.liveLayers((ls) =>
            ls.map((l) => (l.id === selected!.id && l.local ? { ...l, local: { ...l.local, x: nx, y: ny } } : l))
          )
        }
        onEnd={() => editor.endLayers()}
        adjustments={() => editor.store.get().adjustments}
      />
    );
  } else if (movable) {
    handles.push(<Gizmo key={selected.id} session={session} layer={selected} w={sw} h={sh} snap={targets} />);
  }

  return (
    <div
      className="view-box"
      ref={boxRef}
      onPointerDownCapture={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={(e) => onUp(e, true)}
    >
      <div
        className="photo"
        style={{ width: cssW, height: cssH, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))` }}
      >
        <canvas ref={canvasRef} style={{ width: cssW, height: cssH }} />
        <div className={`photo-input${painting ? ' painting' : ''}`} {...paint}>
          {handles}
        </div>
        {st.compareMode && <CompareDivider session={session} multi={() => touches.current.size > 1} />}
      </div>
      {st.zoom !== 100 && <div className="zoom-badge">{st.zoom}%</div>}
    </div>
  );
}

type Size = NonNullable<ReturnType<PhotoSession['size']>>;

/** A point on the photo's rect -> the finished picture (turned about the centre). */
function photoToScene(p: { x: number; y: number }, size: Size, a: Adj) {
  const t = ((a.rotation90 + a.fineRotation) * Math.PI) / 180;
  const dx = p.x - size.photo.w / 2;
  const dy = p.y - size.photo.h / 2;
  return {
    x: size.scene.w / 2 + dx * Math.cos(t) - dy * Math.sin(t),
    y: size.scene.h / 2 + dx * Math.sin(t) + dy * Math.cos(t),
  };
}
function sceneToPhoto(p: { x: number; y: number }, size: Size, a: Adj) {
  const t = -((a.rotation90 + a.fineRotation) * Math.PI) / 180;
  const dx = p.x - size.scene.w / 2;
  const dy = p.y - size.scene.h / 2;
  return {
    x: size.photo.w / 2 + dx * Math.cos(t) - dy * Math.sin(t),
    y: size.photo.h / 2 + dx * Math.sin(t) + dy * Math.cos(t),
  };
}

/** A draggable point at normalized (x, y) of the picture; optional magnetic guides. */
function Handle({
  x,
  y,
  snap,
  onMove,
  onEnd,
  adjustments,
}: {
  x: number;
  y: number;
  snap?: SnapTargets;
  onMove: (nx: number, ny: number) => void;
  onEnd: (from: Adj) => void;
  adjustments: () => Adj;
}) {
  const from = useRef<Adj | null>(null);
  const [guide, setGuide] = useState<{ gx: number | null; gy: number | null } | null>(null);
  const move = (e: ReactPointerEvent) => {
    if (!from.current) return;
    const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    let nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    let ny = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    if (snap) {
      const s = snapToGuides(nx, ny, 0.02, snap);
      nx = s.x;
      ny = s.y;
      setGuide({ gx: s.guideX, gy: s.guideY });
    }
    onMove(nx, ny);
  };
  return (
    <>
      {guide?.gx != null && <div className="guide v" style={{ left: `${guide.gx * 100}%` }} />}
      {guide?.gy != null && <div className="guide h" style={{ top: `${guide.gy * 100}%` }} />}
      <div
        className="handle"
        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          from.current = adjustments();
        }}
        onPointerMove={move}
        onPointerUp={() => {
          if (from.current) onEnd(from.current);
          from.current = null;
          setGuide(null);
        }}
      />
    </>
  );
}

/** Turning this close to a right angle lands on it. */
const ROTATE_SNAP_DEG = 4;

/**
 * The selected layer's box on the picture: drag it to move, the corner to resize, the knob above
 * it to turn. One undo step per gesture.
 */
function Gizmo({
  session,
  layer,
  w,
  h,
  snap,
}: {
  session: PhotoSession;
  layer: EditorLayer;
  w: number;
  h: number;
  snap: SnapTargets;
}) {
  const { editor } = session;
  const box = layerBox(layer, w, h)!;
  const [guide, setGuide] = useState<{ gx: number | null; gy: number | null } | null>(null);
  type Grab = { id: number; mode: 'move' | 'scale' | 'rotate'; start: EditorLayer; cx: number; cy: number; dx: number; dy: number };
  const grab = useRef<Grab | null>(null);
  const areaOf = (el: Element) => el.closest('.photo-input')!.getBoundingClientRect();
  const begin = (e: ReactPointerEvent, mode: Grab['mode']) => {
    e.stopPropagation();
    if (grab.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = areaOf(e.currentTarget);
    const cx = r.left + (box.cx / w) * r.width;
    const cy = r.top + (box.cy / h) * r.height;
    grab.current = { id: e.pointerId, mode, start: layer, cx, cy, dx: e.clientX - cx, dy: e.clientY - cy };
  };
  const move = (e: ReactPointerEvent) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    e.stopPropagation();
    let next: EditorLayer;
    const dx = e.clientX - g.cx;
    const dy = e.clientY - g.cy;
    if (g.mode === 'move') {
      const r = areaOf(e.currentTarget);
      // A layer may hang off the picture, but its centre stays on it so it can be grabbed again.
      const nx = Math.min(1, Math.max(0, (e.clientX - g.dx - r.left) / r.width));
      const ny = Math.min(1, Math.max(0, (e.clientY - g.dy - r.top) / r.height));
      const s = snapToGuides(nx, ny, 0.02, snap);
      setGuide({ gx: s.guideX, gy: s.guideY });
      next = patchElement(g.start, { x: s.x, y: s.y });
    } else if (g.mode === 'scale') {
      next = scaleElement(g.start, Math.hypot(dx, dy) / Math.max(1, Math.hypot(g.dx, g.dy)));
    } else {
      const base = elementOf(g.start)!.rotation ?? 0;
      const turned = base + ((Math.atan2(dy, dx) - Math.atan2(g.dy, g.dx)) * 180) / Math.PI;
      const normal = ((turned % 360) + 360) % 360;
      const right = Math.round(normal / 90) * 90;
      next = patchElement(g.start, { rotation: Math.abs(normal - right) < ROTATE_SNAP_DEG ? right % 360 : normal });
    }
    editor.liveLayers((ls) => ls.map((l) => (l.id === layer.id ? next : l)));
  };
  const end = (e: ReactPointerEvent) => {
    if (grab.current?.id !== e.pointerId) return;
    grab.current = null;
    setGuide(null);
    editor.endLayers();
  };
  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  return (
    <>
      {guide?.gx != null && <div className="guide v" style={{ left: `${guide.gx * 100}%` }} />}
      {guide?.gy != null && <div className="guide h" style={{ top: `${guide.gy * 100}%` }} />}
      <div
        className="gizmo"
        style={{
          left: `${(box.cx / w) * 100}%`,
          top: `${(box.cy / h) * 100}%`,
          width: `${(box.w / w) * 100}%`,
          height: `${(box.h / h) * 100}%`,
          transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`,
        }}
        onPointerDown={(e) => begin(e, 'move')}
        {...handlers}
      >
        <div className="gizmo-knob scale" onPointerDown={(e) => begin(e, 'scale')} {...handlers} aria-label={t('Redimensionar')} />
        <div className="gizmo-knob rotate" onPointerDown={(e) => begin(e, 'rotate')} {...handlers} aria-label={t('Girar')} />
      </div>
    </>
  );
}

function CompareDivider({ session, multi }: { session: PhotoSession; multi: () => boolean }) {
  const split = useStore(session.editor.store, (s) => s.compareSplit);
  const drag = (e: ReactPointerEvent) => {
    if (!(e.buttons & 1) || multi()) return;
    const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    session.editor.setCompareSplit(Math.max(2, Math.min(98, ((e.clientX - r.left) / r.width) * 100)));
  };
  return (
    <div
      className="compare"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag(e);
      }}
      onPointerMove={drag}
    >
      <div className="compare-line" style={{ left: `${split}%` }} />
      <span className="compare-label left">ORIGINAL</span>
      <span className="compare-label right">EDITADA</span>
    </div>
  );
}
