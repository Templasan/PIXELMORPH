import { useState } from 'react';
import type { PhotoSession } from '../../application/session';
import type { PictureRef } from '../../ports/host';
import { BLEND_MODE_LABELS, FRAME_STYLES, LIGHT_TYPES, OVERLAY_TEXTURE_NAMES } from '../../domain/effects';
import { useStore } from '../../state/useStore';
import { Chips, commit, FieldSlider, Swatches } from '../controls';
import { Icon } from '../Icon';

const TABS = ['Retrô', 'Overlays', 'Molduras', 'Iluminação', 'Dupla exposição'] as const;
type Tab = (typeof TABS)[number];

const FRAME_COLORS = ['#111111', '#FFFFFF', '#E5484D', '#F5A623', '#F5D90A', '#30A46C', '#3B82F6'];

const indices = (names: readonly string[]) => names.map((_, i) => i);

/**
 * Efeitos (RF-041/028/060/068/075): each control changes the picture on the GPU or the frame and
 * light drawn over it. `lightEdit` puts the photo into light-positioning mode (the handle is in
 * PhotoView, owned by App).
 */
export function EffectsPanel({
  session,
  lightEdit,
  onLightEdit,
}: {
  session: PhotoSession;
  lightEdit: boolean;
  onLightEdit: (on: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>('Retrô');
  const a = useStore(session.editor.store, (s) => s.adjustments);
  const info = useStore(session.info);
  const slider = (field: string, label: string, min: number, max: number) => (
    <FieldSlider session={session} field={field} label={label} min={min} max={max} />
  );
  const chips = (names: readonly string[], field: string) => (
    <Chips options={indices(names)} value={a[field]} label={(i) => names[i]} onPick={(i) => commit(session, field, i)} />
  );
  const pickTab = (t: Tab) => {
    setTab(t);
    if (t !== 'Iluminação') onLightEdit(false);
  };

  return (
    <>
      <Chips options={TABS} value={tab} onPick={pickTab} />

      {tab === 'Retrô' && (
        <>
          <div className="panel-head">Envelhecimento</div>
          {slider('retroAging', 'Intensidade', 0, 100)}
          {slider('retroAgingBlend', 'Mesclagem', 0, 100)}
          <div className="panel-head">Granulado</div>
          {slider('retroGrain', 'Intensidade', 0, 100)}
          {slider('retroGrainBlend', 'Mesclagem', 0, 100)}
          <div className="panel-head">Vinheta</div>
          {slider('retroVignette', 'Intensidade', 0, 100)}
          {slider('retroVignetteBlend', 'Mesclagem', 0, 100)}
        </>
      )}

      {tab === 'Overlays' && (
        <>
          <div className="panel-head">Repositório interno</div>
          {chips(OVERLAY_TEXTURE_NAMES, 'overlayType')}
          {a.overlayType > 0 && (
            <>
              {slider('overlayIntensity', 'Intensidade', 0, 100)}
              {slider('overlayOpacity', 'Opacidade', 0, 100)}
            </>
          )}
          <div className="panel-head">Galeria do dispositivo</div>
          {info.overlay ? (
            <>
              <Picked picture={info.overlay} onClear={() => session.clearBlend('overlay')} />
              {chips(BLEND_MODE_LABELS, 'overlayBlend')}
              {slider('overlayIntensity', 'Intensidade da imagem', 0, 100)}
            </>
          ) : (
            <button className="chip" onClick={() => void session.pickBlend('overlay')}>
              Importar overlay da galeria
            </button>
          )}
        </>
      )}

      {tab === 'Molduras' && (
        <>
          {chips(FRAME_STYLES, 'frameStyle')}
          {a.frameStyle > 0 && (
            <>
              {slider('frameThickness', 'Espessura', 0, 100)}
              {a.frameStyle === 2 && slider('frameRadius', 'Raio', 0, 100)}
              <div className="panel-head">Cor</div>
              <Swatches options={FRAME_COLORS} value={info.frameColor} onPick={(frameColor) => session.setColors({ frameColor })} />
              {a.frameStyle === 4 && (
                <>
                  <div className="panel-head">Cor do degradê</div>
                  <Swatches
                    options={FRAME_COLORS}
                    value={info.frameGradientColor}
                    onPick={(frameGradientColor) => session.setColors({ frameGradientColor })}
                  />
                </>
              )}
            </>
          )}
        </>
      )}

      {tab === 'Iluminação' && (
        <>
          {chips(LIGHT_TYPES, 'lightType')}
          {slider('lightIntensity', 'Intensidade', 0, 100)}
          <div className="chips">
            <button className={`chip${lightEdit ? ' on' : ''}`} onClick={() => onLightEdit(!lightEdit)}>
              <Icon name="sun" size={14} /> {lightEdit ? 'Posicionando luz' : 'Posicionar luz'}
            </button>
          </div>
          {lightEdit && <div className="muted">Arraste o ponto na foto para posicionar a luz.</div>}
        </>
      )}

      {tab === 'Dupla exposição' && (
        <>
          {info.doubleExposure ? (
            <>
              <Picked picture={info.doubleExposure} onClear={() => session.clearBlend('doubleExposure')} />
              {chips(BLEND_MODE_LABELS, 'doubleExposureBlend')}
              {slider('doubleExposureOpacity', 'Opacidade', 0, 100)}
            </>
          ) : (
            <button className="chip" onClick={() => void session.pickBlend('doubleExposure')}>
              Escolher imagem da galeria
            </button>
          )}
        </>
      )}
    </>
  );
}

function Picked({ picture, onClear }: { picture: PictureRef; onClear: () => void }) {
  return (
    <div className="picked">
      <img src={picture.uri} alt="" />
      <span className="picked-name">{picture.name}</span>
      <button className="icon-btn" onClick={onClear} aria-label="Remover imagem">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
