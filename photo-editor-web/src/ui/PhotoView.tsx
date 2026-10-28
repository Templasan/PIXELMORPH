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
import { useStore } from '../state/useStore';

/** What the canvas does with a finger right now (set by the open tool). */
export type ViewMode = 'none' | 'perspective' | 'light';

/**
 * The picture, fitted to the space it gets. Over it: painting (Camadas with a paint layer),
 * the drag handles of the open tool and the compare divider. Every position is handed to the
 * session in scene units.
 */
export function PhotoView({ session, mode }: { session: PhotoSession; mode: ViewMode }) {
  const { editor } = session;
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const info = useStore(session.info);
  const st = useStore(editor.store);
  const size = info.size && session.size();

  useLayoutEffect(() => {
    const el = boxRef.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the picture in the box; the canvas has the screen's real pixels.
  const zoom = st.zoom / 100;
  const fit = size ? Math.min(box.w / size.scene.w, box.h / size.scene.h) * zoom : 0;
  const cssW = size ? Math.max(1, Math.floor(size.scene.w * fit)) : 0;
  const cssH = size ? Math.max(1, Math.floor(size.scene.h * fit)) : 0;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cssW) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    session.attach(canvas);
    return () => session.detach(canvas);
  }, [session, cssW, cssH]);

  if (info.status === 'error' || !size)
    return (
      <div className="view-box" ref={boxRef}>
        {info.status === 'error' ? <div className="toast">{info.error}</div> : <div className="muted">Abrindo a foto…</div>}
      </div>
    );

  const { w: sw, h: sh } = size.scene;
  const toScene = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * sw, y: ((e.clientY - r.top) / r.height) * sh };
  };
  const selected = st.layers.find((l) => l.id === st.selectedLayerId);
  const painting = st.activeTool === 'camadas' && selected?.kind === 'paint' && !selected.locked;
  const a = st.adjustments;

  const paint = {
    onPointerDown(e: ReactPointerEvent) {
      if (!painting) return;
      (e.target as Element).setPointerCapture(e.pointerId);
      const p = toScene(e);
      editor.appendStrokePoint(p.x, p.y, e.pointerType === 'pen' ? e.pressure : undefined);
    },
    onPointerMove(e: ReactPointerEvent) {
      if (!painting || !(e.buttons & 1)) return;
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
    if (l.text) {
      targets.x.push(l.text.x);
      targets.y.push(l.text.y);
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
  } else if (st.activeTool === 'elementos' && selected && (selected.text || selected.shape)) {
    const el = selected.text ?? selected.shape!;
    handles.push(
      <Handle
        key={selected.id}
        x={el.x}
        y={el.y}
        snap={targets}
        onMove={(nx, ny) =>
          editor.setLayers((ls) =>
            ls.map((l) =>
              l.id !== selected.id
                ? l
                : l.text
                  ? { ...l, text: { ...l.text, x: nx, y: ny } }
                  : l.shape
                    ? { ...l, shape: { ...l.shape, x: nx, y: ny } }
                    : l
            )
          )
        }
        onEnd={() => {}}
        adjustments={() => editor.store.get().adjustments}
      />
    );
  }

  return (
    <div className="view-box" ref={boxRef}>
      <div className="photo" style={{ width: cssW, height: cssH }}>
        <canvas ref={canvasRef} style={{ width: cssW, height: cssH }} />
        <div className={`photo-input${painting ? ' painting' : ''}`} {...paint}>
          {handles}
        </div>
        {st.compareMode && <CompareDivider session={session} />}
      </div>
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

function CompareDivider({ session }: { session: PhotoSession }) {
  const split = useStore(session.editor.store, (s) => s.compareSplit);
  const drag = (e: ReactPointerEvent) => {
    if (!(e.buttons & 1)) return;
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
