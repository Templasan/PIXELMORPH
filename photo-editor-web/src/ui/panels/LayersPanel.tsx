import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { t } from '../../i18n';
import type { PhotoSession } from '../../application/session';
import {
  BRUSH_SHAPES,
  LAYER_BLENDS,
  createPaintLayer,
  distributeLayers,
  duplicateLayer,
  isFixedLayer,
  movableLayers,
  mergeVisiblePaintLayers,
  reorderLayer,
  type EditorLayer,
} from '../../domain/layers';
import { useStore } from '../../state/useStore';
import { Chips, Range, Swatches } from '../controls';
import { Icon } from '../Icon';

const KIND_LABEL: Record<EditorLayer['kind'], string> = {
  background: 'Normal',
  adjustments: 'Ajuste',
  paint: 'Pintura',
  text: 'Texto',
  shape: 'Forma',
  image: 'Imagem',
  local: 'Máscara',
};

const BRUSH_COLORS = ['#E5484D', '#F5A623', '#F5D90A', '#30A46C', '#3B82F6', '#FFFFFF', '#000000'];
const THUMB_PX = 88;

/** The layer alone over a checkerboard; the colour adjustments have no picture of their own. */
function LayerThumb({ session, layer }: { session: PhotoSession; layer: EditorLayer }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) session.drawThumb(ref.current, layer);
  }, [session, layer]);
  if (layer.kind === 'adjustments' || layer.kind === 'local')
    return (
      <div className="layer-thumb">
        <Icon name={layer.kind === 'local' ? 'sun' : 'sliders'} size={16} />
      </div>
    );
  return <canvas ref={ref} className="layer-thumb" width={THUMB_PX} height={THUMB_PX} />;
}

/** Camadas (RF-002/RF-052/RF-033): the layer stack, its actions and the brush of a paint layer. */
export function LayersPanel({ session }: { session: PhotoSession }) {
  const { editor } = session;
  const layers = useStore(editor.store, (s) => s.layers);
  const selectedId = useStore(editor.store, (s) => s.selectedLayerId);
  const brush = useStore(editor.store, (s) => s.brush);
  const [error, setError] = useState<string | null>(null);
  const selected = layers.find((l) => l.id === selectedId);
  const canEdit = !!selected && !isFixedLayer(selected);
  const canDelete = canEdit && !selected.locked;
  const visiblePaint = layers.filter((l) => l.kind === 'paint' && l.visible).length;
  const paintable = selected?.kind === 'paint' && !selected.locked;
  // Distribution moves every visible, unlocked layer that has a position.
  const positioned = movableLayers(layers).length;

  const add = () =>
    editor.addLayers([createPaintLayer(t('Pintura {n}', { n: layers.filter((l) => l.kind === 'paint').length + 1 }))]);
  const addImage = () => {
    setError(null);
    session.addImageLayer().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };
  const addText = () => {
    editor.selectLayer('fundo');
    editor.setTextDraft({ content: '' });
    editor.setTool('elementos');
  };
  const duplicate = () => selected && canEdit && editor.addLayers([duplicateLayer(selected)]);
  const merge = () => {
    editor.setLayers(mergeVisiblePaintLayers);
    // The merge removes the layers it folds in; the selection moves to the survivor if it was one of them.
    const { layers: next, selectedLayerId } = editor.store.get();
    if (!next.some((l) => l.id === selectedLayerId)) {
      const survivor = next.find((l) => l.kind === 'paint');
      if (survivor) editor.selectLayer(survivor.id);
    }
  };
  const remove = () => {
    if (!canDelete) return;
    editor.setLayers((ls) => ls.filter((l) => l.id !== selectedId));
    editor.selectLayer('fundo');
  };
  const toggle = (id: string, key: 'visible' | 'locked') =>
    editor.setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, [key]: !l[key] } : l)));
  const setOpacity = (opacity: number) =>
    editor.liveLayers((ls) => ls.map((l) => (l.id === selectedId ? { ...l, opacity } : l)));
  const toggleClip = () =>
    editor.setLayers((ls) => ls.map((l) => (l.id === selectedId ? { ...l, clip: !l.clip } : l)));
  // There must be something to clip to: the layer right below may not be a fixed one.
  const below = selected ? layers[layers.indexOf(selected) - 1] : undefined;
  const canClip = canEdit && !!below && !isFixedLayer(below);
  const setBlend = (blend: EditorLayer['blend']) =>
    editor.setLayers((ls) => ls.map((l) => (l.id === selectedId ? { ...l, blend } : l)));

  // The grip drags a row: the list shows the top of the stack first, so down is a lower index.
  const drag = useRef<{ id: string; y0: number; index0: number; rowH: number } | null>(null);
  const onGripDown = (e: ReactPointerEvent<HTMLElement>, id: string) => {
    e.stopPropagation();
    // On the list, not the grip: a row moving down the list is a new element under the finger.
    e.currentTarget.closest('.layer-list')!.setPointerCapture(e.pointerId);
    const row = e.currentTarget.closest<HTMLElement>('.layer-row')!;
    drag.current = { id, y0: e.clientY, index0: layers.findIndex((l) => l.id === id), rowH: row.offsetHeight };
  };
  const onGripMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const to = d.index0 - Math.round((e.clientY - d.y0) / d.rowH);
    editor.liveLayers((ls) => reorderLayer(ls, d.id, to));
  };
  const onGripUp = () => {
    if (!drag.current) return;
    drag.current = null;
    editor.endLayers();
  };

  return (
    <>
      <div className="chips">
        <button className="chip" onClick={add}>
          <Icon name="plus" size={14} /> {t('Pintura')}
        </button>
        <button className="chip" onClick={addImage}>
          <Icon name="plus" size={14} /> {t('Imagem')}
        </button>
        <button className="chip" onClick={addText}>
          <Icon name="plus" size={14} /> {t('Texto')}
        </button>
      </div>
      {error && <div className="muted">{error}</div>}

      <div className="layer-list" onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp}>
        {[...layers].reverse().map((l) => {
          const strokes = l.strokes?.length ?? 0;
          const blendName = LAYER_BLENDS.find((b) => b.id === l.blend)?.name;
          return (
            <div
              key={l.id}
              className={`layer-row${l.id === selectedId ? ' on' : ''}${l.clip ? ' clipped' : ''}`}
              onClick={() => editor.selectLayer(l.id)}
            >
              <button
                className={`eye${l.visible ? '' : ' off'}`}
                aria-label={l.visible ? t('Ocultar camada') : t('Mostrar camada')}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(l.id, 'visible');
                }}
              >
                <Icon name="eye" size={15} />
              </button>
              <LayerThumb session={session} layer={l} />
              <div className={`layer-name${l.visible ? '' : ' dim'}`}>
                <div>{l.name}</div>
                <div className="muted">
                  {isFixedLayer(l) ? t(KIND_LABEL[l.kind]) : `${l.opacity}% ${t(blendName ?? 'Normal')}`}
                  {l.kind === 'paint' ? ` · ${t(strokes === 1 ? '{n} traço' : '{n} traços', { n: strokes })}` : ''}
                </div>
              </div>
              {isFixedLayer(l) ? (
                l.locked && <Icon name="lock" size={12} />
              ) : (
                <>
                  <button
                    className={`eye${l.locked ? '' : ' off'}`}
                    aria-label={l.locked ? t('Destravar camada') : t('Travar camada')}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(l.id, 'locked');
                    }}
                  >
                    <Icon name="lock" size={14} />
                  </button>
                  <div
                    className="layer-grip"
                    role="button"
                    aria-label={t('Arrastar para reordenar')}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => onGripDown(e, l.id)}
                  >
                    ≡
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="chips">
        <button className="icon-btn" disabled={!canEdit} onClick={duplicate} aria-label={t('Duplicar camada')}>
          <Icon name="copy" size={20} />
        </button>
        <button className="icon-btn" disabled={visiblePaint < 2} onClick={merge} aria-label={t('Mesclar camadas visíveis')}>
          <Icon name="layers" size={20} />
        </button>
        <button className="icon-btn" disabled={!canDelete} onClick={remove} aria-label={t('Excluir camada')}>
          <Icon name="trash" size={20} />
        </button>
        <button className={`chip${selected?.clip ? ' on' : ''}`} disabled={!canClip} onClick={toggleClip}>
          {t('Recortar na camada de baixo')}
        </button>
        {selected?.kind === 'text' && (
          <button className="chip" onClick={() => editor.setTool('elementos')}>
            {t('Editar texto')}
          </button>
        )}
      </div>

      {canEdit && (
        <>
          <div onPointerUp={() => editor.endLayers()} onKeyUp={() => editor.endLayers()}>
            <Range label={t('Opacidade')} value={selected.opacity} min={0} max={100} format={(v) => `${v}%`} onChange={setOpacity} />
          </div>
          <Chips
            options={LAYER_BLENDS.map((b) => b.id)}
            value={selected.blend ?? 'source-over'}
            label={(id) => t(LAYER_BLENDS.find((b) => b.id === id)!.name)}
            onPick={setBlend}
          />
        </>
      )}

      <div className="chips">
        <button className="chip" disabled={positioned < 3} onClick={() => editor.setLayers((ls) => distributeLayers(ls, 'horizontal'))}>
          {t('Distribuir na horizontal')}
        </button>
        <button className="chip" disabled={positioned < 3} onClick={() => editor.setLayers((ls) => distributeLayers(ls, 'vertical'))}>
          {t('Distribuir na vertical')}
        </button>
      </div>

      {paintable && (
        <>
          <Swatches options={BRUSH_COLORS} value={brush.color} onPick={(color) => editor.setBrush({ color })} />
          <Chips
            options={BRUSH_SHAPES.map((s) => s.id)}
            value={brush.shape}
            label={(id) => BRUSH_SHAPES.find((s) => s.id === id)?.glyph}
            onPick={(shape) => editor.setBrush({ shape })}
          />
          <Range label={t('Tamanho')} value={brush.size} min={2} max={40} step={2} format={(v) => `${v}px`} onChange={(size) => editor.setBrush({ size })} />
          <Range label={t('Opacidade do pincel')} value={brush.opacity} min={10} max={100} step={10} format={(v) => `${v}%`} onChange={(opacity) => editor.setBrush({ opacity })} />
          <div className="muted">{t('Arraste na foto para pintar na camada selecionada.')}</div>
        </>
      )}
    </>
  );
}
