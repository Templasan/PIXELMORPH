import { t } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { COLLAGE_SIZE, type PhotoSession } from '../../application/session';
import {
  cellPixelRect,
  CENTRED_PAN,
  CUSTOM_GRID_MAX,
  COLLAGE_LAYOUTS,
  gridLayout,
  panByDrag,
  type CellPan,
} from '../../domain/collage/CollageMath';
import { drawCollage } from '../../engine/compose';
import type { PictureRef } from '../../ports/host';
import { useStore } from '../../state/useStore';
import { Chips, Range, Swatches } from '../controls';

const BORDER_COLORS = ['#FFFFFF', '#000000', '#3A8FDE'];
const CUSTOM = 'custom';
/** The preview is drawn at this size; spacing and borders scale down with it. */
const PREVIEW_SIZE = 480;
const PREVIEW_PICTURE_EDGE = 512;

interface CellPicture {
  ref: PictureRef;
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/**
 * Colagem (RF-011): a picture per cell from the gallery. The preview is the drawing the project
 * gets; dragging a photo in it pans the photo inside its cell. The result opens as a new project.
 */
export function CollageSection({ session }: { session: PhotoSession }) {
  const busy = useStore(session.info, (i) => i.busy !== null);
  const [layoutId, setLayoutId] = useState(COLLAGE_LAYOUTS[0].id);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const layout =
    layoutId === CUSTOM ? gridLayout(rows, cols) : COLLAGE_LAYOUTS.find((l) => l.id === layoutId)!;
  const [cells, setCells] = useState<(CellPicture | null)[]>([]);
  const [pans, setPans] = useState<CellPan[]>([]);
  const [spacing, setSpacing] = useState(8);
  const [borderWidth, setBorderWidth] = useState(4);
  const [shadow, setShadow] = useState(0);
  const [borderColor, setBorderColor] = useState(BORDER_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const picked = layout.cells.map((_, i) => cells[i] ?? null);
  const cellPans = layout.cells.map((_, i) => pans[i] ?? CENTRED_PAN);
  const previewRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ cell: number; x: number; y: number } | null>(null);
  const scale = PREVIEW_SIZE / COLLAGE_SIZE;

  const pick = async (i: number) => {
    const ref = await session.pickPicture();
    if (!ref) return;
    const { bitmap, width, height } = await session.loadSmall(ref.uri, PREVIEW_PICTURE_EDGE);
    setCells((c) => Object.assign([...c], { [i]: { ref, bitmap, width, height } }));
    setPans((p) => Object.assign([...p], { [i]: CENTRED_PAN }));
  };

  // Redrawn on every change; the preview is one canvas, replaced each time.
  useEffect(() => {
    const host = previewRef.current;
    if (!host) return;
    const canvas = drawCollage(
      picked.map((c) => c?.bitmap),
      picked.map((c) => (c ? { width: c.width, height: c.height } : undefined)),
      layout,
      PREVIEW_SIZE,
      { spacing: spacing * scale, borderWidth: borderWidth * scale, borderColor, shadow: shadow / 100, pans: cellPans }
    );
    canvas.style.width = '100%';
    canvas.style.display = 'block';
    host.replaceChildren(canvas);
  });

  const cellAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    return layout.cells.findIndex((c) => nx >= c.x && nx < c.x + c.width && ny >= c.y && ny < c.y + c.height);
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const i = cellAt(e);
    if (i < 0 || !picked[i]) return;
    drag.current = { cell: i, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - d.x) / r.width) * PREVIEW_SIZE;
    const dy = ((e.clientY - d.y) / r.height) * PREVIEW_SIZE;
    d.x = e.clientX;
    d.y = e.clientY;
    const cell = cellPixelRect(layout.cells[d.cell], PREVIEW_SIZE, PREVIEW_SIZE, spacing * scale);
    const pic = picked[d.cell]!;
    setPans((list) =>
      Object.assign([...list], { [d.cell]: panByDrag(pic, cell, list[d.cell] ?? CENTRED_PAN, dx, dy) })
    );
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <>
      <Chips
        options={[...COLLAGE_LAYOUTS.map((l) => l.id), CUSTOM]}
        value={layoutId}
        label={(id) => (id === CUSTOM ? t('Personalizado') : t(COLLAGE_LAYOUTS.find((l) => l.id === id)!.label))}
        onPick={setLayoutId}
      />
      {layoutId === CUSTOM && (
        <>
          <Stepper label={t('Linhas')} value={rows} onChange={setRows} />
          <Stepper label={t('Colunas')} value={cols} onChange={setCols} />
        </>
      )}
      <div className="chips">
        {picked.map((c, i) => (
          <button key={i} className={`chip${c ? ' on' : ''}`} onClick={() => void pick(i)}>
            {i + 1}. {c ? c.ref.name : t('Escolher foto')}
          </button>
        ))}
      </div>
      <div
        ref={previewRef}
        style={{ touchAction: 'none', cursor: 'grab' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <div className="muted">{t('Arraste a foto dentro da célula para enquadrar.')}</div>
      <Range label={t('Espaçamento')} value={spacing} min={0} max={40} onChange={setSpacing} />
      <Range label={t('Borda')} value={borderWidth} min={0} max={20} onChange={setBorderWidth} />
      <Range label={t('Sombra')} value={shadow} min={0} max={100} format={(v) => `${Math.round(v)}%`} onChange={setShadow} />
      <Swatches options={BORDER_COLORS} value={borderColor} onPick={setBorderColor} />
      <button
        className="primary-btn wide"
        disabled={busy || picked.some((c) => !c)}
        onClick={() =>
          session
            .createCollage(picked.map((c) => c!.ref), layout, {
              spacing,
              borderWidth,
              borderColor,
              shadow: shadow / 100,
              pans: cellPans,
            })
            .catch((e) => setError(t('Não foi possível criar a colagem: {msg}', { msg: e?.message ?? e })))
        }
      >
        {t('Criar colagem')}
      </button>
      {error && <div className="muted">{error}</div>}
    </>
  );
}

/** A count from 1 to CUSTOM_GRID_MAX with − and + (the custom collage's rows and columns). */
function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="panel-row">
      <span>{label}</span>
      <span>
        <button className="chip" disabled={value <= 1} onClick={() => onChange(value - 1)}>
          −
        </button>{' '}
        {value}{' '}
        <button className="chip" disabled={value >= CUSTOM_GRID_MAX} onClick={() => onChange(value + 1)}>
          +
        </button>
      </span>
    </div>
  );
}

/** Panorama (US-28): photos left to right with a faded overlap; the result opens as a new project. */
export function PanoramaPanel({ session }: { session: PhotoSession }) {
  const busy = useStore(session.info, (i) => i.busy !== null);
  const [items, setItems] = useState<{ ref: PictureRef; offsetY: number; overlap: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [aligning, setAligning] = useState(false);
  const add = async () => {
    const ref = await session.pickPicture();
    if (ref) setItems((list) => [...list, { ref, offsetY: 0, overlap: 15 }]);
  };
  const patch = (i: number, change: Partial<(typeof items)[number]>) =>
    setItems((list) => list.map((it, k) => (k === i ? { ...it, ...change } : it)));
  const align = async () => {
    setAligning(true);
    setNote(null);
    setError(null);
    try {
      const pairs = await session.alignPanorama(items.map((it) => it.ref));
      // Each shift is from the photo before; the layout wants each photo's place from the first.
      let y = 0;
      setItems((list) =>
        list.map((it, i) => {
          const pair = pairs[i];
          y += pair ? pair.offsetY * 100 : it.offsetY - (list[i - 1]?.offsetY ?? 0);
          return i === 0 ? it : { ...it, offsetY: y, overlap: pair ? pair.overlap * 100 : it.overlap };
        })
      );
      const missed = pairs.slice(1).filter((p) => !p).length;
      setNote(
        missed === 0
          ? t('Fotos alinhadas. Ajuste abaixo se notar algum erro.')
          : t('{n} par de fotos não foi alinhado: elas têm pouco em comum. Ajuste à mão.', { n: missed })
      );
    } catch (e) {
      setError(t('Não foi possível alinhar: {msg}', { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setAligning(false);
    }
  };
  return (
    <>
      {items.length === 0 && <div className="muted">{t('Adicione as fotos da esquerda para a direita.')}</div>}
      {items.map((item, i) => (
        <div key={i} className="field">
          <div className="panel-row">
            <span>
              {i + 1}. {item.ref.name}
            </span>
            <button className="chip" onClick={() => setItems((list) => list.filter((_, k) => k !== i))}>
              {t('Remover')}
            </button>
          </div>
          {i > 0 && (
            <Range
              label={t('Alinhar na vertical')}
              value={item.offsetY}
              min={-20}
              max={20}
              format={(v) => `${Math.round(v)}%`}
              onChange={(offsetY) => patch(i, { offsetY })}
            />
          )}
          {i > 0 && (
            <Range label={t('Sobreposição')} value={item.overlap} min={0} max={60} format={(v) => `${Math.round(v)}%`} onChange={(overlap) => patch(i, { overlap })} />
          )}
        </div>
      ))}
      <button className="chip" onClick={() => void add()}>
        + {t('Adicionar foto')}
      </button>
      <button className="chip" disabled={items.length < 2 || aligning} onClick={() => void align()}>
        {aligning ? t('Alinhando…') : t('Alinhar automaticamente')}
      </button>
      {note && <div className="muted">{note}</div>}
      <button
        className="primary-btn wide"
        disabled={busy || items.length < 2}
        onClick={() =>
          session
            .createPanorama(
              items.map((it) => it.ref),
              items.map((it) => it.overlap / 100),
              items.map((it) => it.offsetY / 100)
            )
            .catch((e) => setError(t('Não foi possível criar o panorama: {msg}', { msg: e?.message ?? e })))
        }
      >
        {t('Criar panorama')}
      </button>
      {error && <div className="muted">{error}</div>}
    </>
  );
}
