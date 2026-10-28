import type { PhotoSession } from '../../application/session';
import {
  BRUSH_SHAPES,
  createPaintLayer,
  duplicateLayer,
  mergeVisiblePaintLayers,
  type EditorLayer,
} from '../../domain/layers';
import { useStore } from '../../state/useStore';
import { Chips, Range, Swatches } from '../controls';
import { Icon } from '../Icon';

const KIND_ICON: Record<EditorLayer['kind'], string> = {
  background: 'image',
  adjustments: 'sliders',
  paint: 'ripple',
  text: 'type',
  shape: 'crop',
};

const KIND_LABEL: Record<EditorLayer['kind'], string> = {
  background: 'Normal',
  adjustments: 'Ajuste',
  paint: 'Pintura',
  text: 'Texto',
  shape: 'Forma',
};

const BRUSH_COLORS = ['#E5484D', '#F5A623', '#F5D90A', '#30A46C', '#3B82F6', '#FFFFFF', '#000000'];

/** Camadas (RF-002/RF-052/RF-033): the layer stack, its actions and the brush of a paint layer. */
export function LayersPanel({ session }: { session: PhotoSession }) {
  const { editor } = session;
  const layers = useStore(editor.store, (s) => s.layers);
  const selectedId = useStore(editor.store, (s) => s.selectedLayerId);
  const brush = useStore(editor.store, (s) => s.brush);
  const selected = layers.find((l) => l.id === selectedId);
  const canDuplicate = selected?.kind === 'paint';
  const canDelete = !!selected && !selected.locked && selected.kind !== 'background';
  const visiblePaint = layers.filter((l) => l.kind === 'paint' && l.visible).length;
  const paintable = selected?.kind === 'paint' && !selected.locked;

  const add = () =>
    editor.addLayers([createPaintLayer(`Pintura ${layers.filter((l) => l.kind === 'paint').length + 1}`)]);
  const duplicate = () => selected && canDuplicate && editor.addLayers([duplicateLayer(selected)]);
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
  const setVisible = (id: string) =>
    editor.setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  const setOpacity = (opacity: number) =>
    editor.setLayers((ls) => ls.map((l) => (l.id === selectedId ? { ...l, opacity } : l)));

  return (
    <>
      <div className="chips">
        <button className="icon-btn" onClick={add} aria-label="Nova camada de pintura">
          <Icon name="plus" />
        </button>
        <button className="icon-btn" disabled={!canDuplicate} onClick={duplicate} aria-label="Duplicar camada">
          <Icon name="copy" size={20} />
        </button>
        <button className="icon-btn" disabled={visiblePaint < 2} onClick={merge} aria-label="Mesclar camadas visíveis">
          <Icon name="layers" size={20} />
        </button>
        <button className="icon-btn" disabled={!canDelete} onClick={remove} aria-label="Excluir camada">
          <Icon name="trash" size={20} />
        </button>
      </div>

      <div className="layer-list">
        {[...layers].reverse().map((l) => {
          const strokes = l.strokes?.length ?? 0;
          return (
            <div
              key={l.id}
              className={`layer-row${l.id === selectedId ? ' on' : ''}`}
              onClick={() => editor.selectLayer(l.id)}
            >
              <button
                className={`eye${l.visible ? '' : ' off'}`}
                aria-label={l.visible ? 'Ocultar camada' : 'Mostrar camada'}
                onClick={(e) => {
                  e.stopPropagation();
                  setVisible(l.id);
                }}
              >
                <Icon name="eye" size={15} />
              </button>
              <Icon name={KIND_ICON[l.kind]} size={14} />
              <div className={`layer-name${l.visible ? '' : ' dim'}`}>
                <div>{l.name}</div>
                <div className="muted">
                  {KIND_LABEL[l.kind]}
                  {l.kind === 'paint' ? ` · ${strokes} ${strokes === 1 ? 'traço' : 'traços'}` : ''}
                </div>
              </div>
              {l.locked && <Icon name="lock" size={12} />}
            </div>
          );
        })}
      </div>

      {selected && (
        <Range label="Opacidade" value={selected.opacity} min={0} max={100} format={(v) => `${v}%`} onChange={setOpacity} />
      )}

      {paintable && (
        <>
          <Swatches options={BRUSH_COLORS} value={brush.color} onPick={(color) => editor.setBrush({ color })} />
          <Chips
            options={BRUSH_SHAPES.map((s) => s.id)}
            value={brush.shape}
            label={(id) => BRUSH_SHAPES.find((s) => s.id === id)?.glyph}
            onPick={(shape) => editor.setBrush({ shape })}
          />
          <Range label="Tamanho" value={brush.size} min={2} max={40} step={2} format={(v) => `${v}px`} onChange={(size) => editor.setBrush({ size })} />
          <Range label="Opacidade do pincel" value={brush.opacity} min={10} max={100} step={10} format={(v) => `${v}%`} onChange={(opacity) => editor.setBrush({ opacity })} />
          <div className="muted">Arraste na foto para pintar na camada selecionada.</div>
        </>
      )}
    </>
  );
}
