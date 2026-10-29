import { useState } from 'react';
import type { PhotoSession } from '../../application/session';
import { COLLAGE_LAYOUTS } from '../../domain/collage/CollageMath';
import type { PictureRef } from '../../ports/host';
import { useStore } from '../../state/useStore';
import { Chips, Range, Swatches } from '../controls';

const BORDER_COLORS = ['#FFFFFF', '#000000', '#3A8FDE'];

/** Colagem (RF-011): a picture per cell from the gallery; the result opens as a new project. */
export function CollageSection({ session }: { session: PhotoSession }) {
  const busy = useStore(session.info, (i) => i.busy !== null);
  const [layoutId, setLayoutId] = useState(COLLAGE_LAYOUTS[0].id);
  const layout = COLLAGE_LAYOUTS.find((l) => l.id === layoutId)!;
  const [cells, setCells] = useState<(PictureRef | null)[]>([]);
  const [spacing, setSpacing] = useState(8);
  const [borderWidth, setBorderWidth] = useState(4);
  const [borderColor, setBorderColor] = useState(BORDER_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const refs = layout.cells.map((_, i) => cells[i] ?? null);
  const pick = async (i: number) => {
    const ref = await session.pickPicture();
    if (ref) setCells((c) => Object.assign([...c], { [i]: ref }));
  };
  return (
    <>
      <Chips
        options={COLLAGE_LAYOUTS.map((l) => l.id)}
        value={layoutId}
        label={(id) => COLLAGE_LAYOUTS.find((l) => l.id === id)!.label}
        onPick={setLayoutId}
      />
      <div className="chips">
        {refs.map((ref, i) => (
          <button key={i} className={`chip${ref ? ' on' : ''}`} onClick={() => void pick(i)}>
            {i + 1}. {ref ? ref.name : 'Escolher foto'}
          </button>
        ))}
      </div>
      <Range label="Espaçamento" value={spacing} min={0} max={40} onChange={setSpacing} />
      <Range label="Borda" value={borderWidth} min={0} max={20} onChange={setBorderWidth} />
      <Swatches options={BORDER_COLORS} value={borderColor} onPick={setBorderColor} />
      <button
        className="primary-btn wide"
        disabled={busy || refs.some((r) => !r)}
        onClick={() =>
          session
            .createCollage(refs as PictureRef[], layout, { spacing, borderWidth, borderColor })
            .catch((e) => setError(`Não foi possível criar a colagem: ${e?.message ?? e}`))
        }
      >
        Criar colagem
      </button>
      {error && <div className="muted">{error}</div>}
    </>
  );
}

/** Panorama (US-28): photos left to right with a faded overlap; the result opens as a new project. */
export function PanoramaPanel({ session }: { session: PhotoSession }) {
  const busy = useStore(session.info, (i) => i.busy !== null);
  const [items, setItems] = useState<{ ref: PictureRef; offsetY: number }[]>([]);
  const [overlap, setOverlap] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    const ref = await session.pickPicture();
    if (ref) setItems((list) => [...list, { ref, offsetY: 0 }]);
  };
  return (
    <>
      {items.length === 0 && <div className="muted">Adicione as fotos da esquerda para a direita.</div>}
      {items.map((item, i) => (
        <div key={i} className="field">
          <div className="panel-row">
            <span>
              {i + 1}. {item.ref.name}
            </span>
            <button className="chip" onClick={() => setItems((list) => list.filter((_, k) => k !== i))}>
              Remover
            </button>
          </div>
          {i > 0 && (
            <Range
              label="Alinhar na vertical"
              value={item.offsetY}
              min={-20}
              max={20}
              format={(v) => `${Math.round(v)}%`}
              onChange={(offsetY) => setItems((list) => list.map((it, k) => (k === i ? { ...it, offsetY } : it)))}
            />
          )}
        </div>
      ))}
      <button className="chip" onClick={() => void add()}>
        + Adicionar foto
      </button>
      <Range label="Sobreposição" value={overlap} min={0} max={50} format={(v) => `${Math.round(v)}%`} onChange={setOverlap} />
      <button
        className="primary-btn wide"
        disabled={busy || items.length < 2}
        onClick={() =>
          session
            .createPanorama(
              items.map((it) => it.ref),
              overlap / 100,
              items.map((it) => it.offsetY / 100)
            )
            .catch((e) => setError(`Não foi possível criar o panorama: ${e?.message ?? e}`))
        }
      >
        Criar panorama
      </button>
      {error && <div className="muted">{error}</div>}
    </>
  );
}
