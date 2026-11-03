import { t } from '../../i18n';
import type { PhotoSession } from '../../application/session';
import { createCloneAdjust, createLiquifyLayer, createLocalLayer, type WarpMode } from '../../domain/layers';
import { useStore } from '../../state/useStore';
import { Chips, Range } from '../controls';

const MODES: { id: WarpMode; label: string }[] = [
  { id: 'push', label: 'Empurrar' },
  { id: 'pull', label: 'Puxar' },
  { id: 'twirl', label: 'Girar' },
];

/** Retoque (US-07): clone and liquify, each one a layer, so the photo itself is never touched. */
export function RetouchPanel({ session }: { session: PhotoSession }) {
  const { editor } = session;
  const layers = useStore(editor.store, (s) => s.layers);
  const selectedId = useStore(editor.store, (s) => s.selectedLayerId);
  const brush = useStore(editor.store, (s) => s.brush);
  const warp = useStore(editor.store, (s) => s.warpBrush);
  const tools = layers.filter((l) => l.warp || l.local?.clone);
  const selected = tools.find((l) => l.id === selectedId);
  const count = (prefix: string) => t(prefix, { n: tools.length + 1 });

  return (
    <>
      <div className="chips">
        <button className="chip" onClick={() => editor.addLayers([createLocalLayer(count('Clonagem {n}'), createCloneAdjust())])}>
          + {t('Clonar')}
        </button>
        <button className="chip" onClick={() => editor.addLayers([createLiquifyLayer(count('Liquify {n}'))])}>
          + {t('Liquify')}
        </button>
      </div>
      {tools.length > 0 && (
        <div className="chips">
          {tools.map((l) => (
            <button key={l.id} className={`chip${l.id === selectedId ? ' on' : ''}`} onClick={() => editor.selectLayer(l.id)}>
              {l.name}
            </button>
          ))}
        </div>
      )}
      {!selected && <div className="muted">{t('Clone ou deforme partes da foto sem alterar o original.')}</div>}
      {selected?.local && (
        <>
          <Range label={t('Tamanho do pincel')} value={brush.size} min={2} max={80} step={2} format={(v) => `${v}px`} onChange={(size) => editor.setBrush({ size })} />
          <div className="muted">
            {selected.local.strokes.length === 0
              ? t('Arraste o ponto até o que quer copiar e pinte onde quer a cópia.')
              : t('Continue pintando: a cópia segue o seu dedo.')}
          </div>
        </>
      )}
      {selected?.warp && (
        <>
          <Chips options={MODES.map((m) => m.id)} value={warp.mode} label={(id) => t(MODES.find((m) => m.id === id)!.label)} onPick={(mode) => editor.setWarpBrush({ mode })} />
          <Range label={t('Tamanho do pincel')} value={warp.radius} min={10} max={120} step={2} format={(v) => `${v}px`} onChange={(radius) => editor.setWarpBrush({ radius })} />
          <Range label={t('Intensidade')} value={Math.round(warp.strength * 100)} min={5} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => editor.setWarpBrush({ strength: v / 100 })} />
          <div className="muted">{t('Arraste na foto para deformar.')}</div>
        </>
      )}
    </>
  );
}
