import { t } from '../../i18n';
import type { PhotoSession } from '../../application/session';
import {
  createFocusAdjust,
  createLocalAdjust,
  createLocalLayer,
  type LocalAdjust,
} from '../../domain/layers';
import { useStore } from '../../state/useStore';
import { Range } from '../controls';

const CREATE = [
  { label: 'Pincel', make: () => createLocalAdjust('brush') },
  { label: 'Por cor', make: () => createLocalAdjust('color') },
  { label: 'Linear', make: () => createLocalAdjust('linear') },
  { label: 'Radial', make: () => createLocalAdjust('radial') },
  { label: 'Foco', make: createFocusAdjust },
];

const percent = (v: number) => `${Math.round(v)}%`;

/** Máscaras (US-06): changes that apply only to part of the picture, each one a layer. */
export function MasksPanel({ session }: { session: PhotoSession }) {
  const { editor } = session;
  const layers = useStore(editor.store, (s) => s.layers);
  const selectedId = useStore(editor.store, (s) => s.selectedLayerId);
  const brush = useStore(editor.store, (s) => s.brush);
  const masks = layers.filter((l) => l.local && !l.local.clone && !l.local.remove);
  const selected = masks.find((l) => l.id === selectedId);
  const local = selected?.local;
  const set = (patch: Partial<LocalAdjust>) =>
    editor.liveLayers((ls) => ls.map((l) => (l.id === selectedId && l.local ? { ...l, local: { ...l.local, ...patch } } : l)));
  const end = () => editor.endLayers();

  return (
    <>
      <div className="chips">
        {CREATE.map((c) => (
          <button
            key={c.label}
            className="chip"
            onClick={() => editor.addLayers([createLocalLayer(t(c.label), c.make())])}
          >
            + {t(c.label)}
          </button>
        ))}
      </div>
      {masks.length > 0 && (
        <div className="chips">
          {masks.map((l) => (
            <button key={l.id} className={`chip${l.id === selectedId ? ' on' : ''}`} onClick={() => editor.selectLayer(l.id)}>
              {l.name}
            </button>
          ))}
        </div>
      )}
      {!local && <div className="muted">{t('Crie uma máscara para mudar só parte da foto.')}</div>}
      {local && (
        <div onPointerUp={end} onKeyUp={end}>
          {local.mask === 'brush' && (
            <>
              <Range label={t('Tamanho do pincel')} value={brush.size} min={2} max={80} step={2} format={(v) => `${v}px`} onChange={(size) => editor.setBrush({ size })} />
              <div className="muted">{t('Pinte na foto a área que muda.')}</div>
            </>
          )}
          {local.mask === 'color' && (
            <>
              <Range label={t('Tolerância')} value={local.tolerance} min={0} max={100} format={percent} onChange={(tolerance) => set({ tolerance })} />
              <div className="muted">{t('Arraste o ponto na foto até a cor que muda.')}</div>
            </>
          )}
          {local.mask === 'linear' && (
            <Range label={t('Ângulo')} value={local.angle} min={0} max={360} format={(v) => `${v}°`} onChange={(angle) => set({ angle })} />
          )}
          {local.mask === 'radial' && (
            <Range label={t('Raio')} value={local.radius * 100} min={2} max={150} format={percent} onChange={(v) => set({ radius: v / 100 })} />
          )}
          {(local.mask === 'linear' || local.mask === 'radial') && (
            <Range label={t('Suavidade')} value={local.feather * 100} min={0} max={100} format={percent} onChange={(v) => set({ feather: v / 100 })} />
          )}
          <Range label={t('Brilho')} value={local.brightness} min={-100} max={100} onChange={(brightness) => set({ brightness })} />
          <Range label={t('Contraste')} value={local.contrast} min={-100} max={100} onChange={(contrast) => set({ contrast })} />
          <Range label={t('Saturação')} value={local.saturation} min={-100} max={100} onChange={(saturation) => set({ saturation })} />
          <Range label={t('Desfoque')} value={local.blur} min={0} max={30} step={0.5} format={(v) => v.toFixed(1)} onChange={(blur) => set({ blur })} />
          <div className="chips">
            <button
              className={`chip${local.invert ? ' on' : ''}`}
              onClick={() => editor.setLayers((ls) => ls.map((l) => (l.id === selectedId && l.local ? { ...l, local: { ...l.local, invert: !l.local.invert } } : l)))}
            >
              {t('Inverter')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
