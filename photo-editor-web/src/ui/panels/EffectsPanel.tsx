import { ART_STYLES, createArtLayer } from '../../domain/layers';
import { t } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import type { PhotoSession } from '../../application/session';
import type { PictureRef } from '../../ports/host';
import { BLEND_MODE_LABELS, FRAME_STYLES, LIGHT_TYPES, OVERLAY_TEXTURE_NAMES } from '../../domain/effects';
import { useStore } from '../../state/useStore';
import { Chips, commit, FieldSlider, Swatches, Range } from '../controls';
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
/** RF-050: a painted look as a layer: its opacity is the intensity, and Comparar shows the original. */
function ArtSection({ session }: { session: PhotoSession }) {
  const { editor } = session;
  const layer = useStore(editor.store, (s) => s.layers.find((l) => l.art));
  return (
    <>
      <div className="sub">{t('Filtros artísticos')}</div>
      <div className="chips">
        {ART_STYLES.map((a) => (
          <button
            key={a.id}
            className={`chip${layer?.art === a.id ? ' on' : ''}`}
            onClick={() =>
              editor.setLayers((ls) =>
                layer?.art === a.id
                  ? ls.filter((l) => l.id !== layer.id)
                  : layer
                    ? ls.map((l) => (l.id === layer.id ? { ...l, art: a.id, name: t(a.name) } : l))
                    : [...ls, createArtLayer(t(a.name), a.id)]
              )
            }
          >
            {t(a.name)}
          </button>
        ))}
      </div>
      {layer && (
        <div onPointerUp={() => editor.endLayers()} onKeyUp={() => editor.endLayers()}>
          <Range
            label={t('Intensidade')}
            value={layer.opacity}
            min={0}
            max={100}
            format={(v) => `${v}%`}
            onChange={(opacity) => editor.liveLayers((ls) => ls.map((l) => (l.id === layer.id ? { ...l, opacity } : l)))}
          />
        </div>
      )}
    </>
  );
}

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
    <Chips options={indices(names)} value={a[field]} label={(i) => t(names[i])} onPick={(i) => commit(session, field, i)} />
  );
  const pickTab = (t: Tab) => {
    setTab(t);
    if (t !== 'Iluminação') onLightEdit(false);
  };

  return (
    <>
      <ArtSection session={session} />
      <Chips options={TABS} value={tab} onPick={pickTab} />

      {tab === 'Retrô' && (
        <>
          <div className="panel-head">{t('Envelhecimento')}</div>
          {slider('retroAging', t('Intensidade'), 0, 100)}
          {slider('retroAgingBlend', t('Mesclagem'), 0, 100)}
          <div className="panel-head">{t('Granulado')}</div>
          {slider('retroGrain', t('Intensidade'), 0, 100)}
          {slider('retroGrainBlend', t('Mesclagem'), 0, 100)}
          <div className="panel-head">{t('Vinheta')}</div>
          {slider('retroVignette', t('Intensidade'), 0, 100)}
          {slider('retroVignetteBlend', t('Mesclagem'), 0, 100)}
        </>
      )}

      {tab === 'Overlays' && (
        <>
          <div className="panel-head">{t('Repositório interno')}</div>
          {chips(OVERLAY_TEXTURE_NAMES, 'overlayType')}
          {a.overlayType > 0 && (
            <>
              {slider('overlayIntensity', t('Intensidade'), 0, 100)}
              {slider('overlayOpacity', t('Opacidade'), 0, 100)}
            </>
          )}
          <div className="panel-head">{t('Galeria do dispositivo')}</div>
          {info.overlay ? (
            <>
              <Picked session={session} picture={info.overlay} onClear={() => session.clearBlend('overlay')} />
              {chips(BLEND_MODE_LABELS, 'overlayBlend')}
              {slider('overlayIntensity', t('Intensidade da imagem'), 0, 100)}
            </>
          ) : (
            <button className="chip" onClick={() => void session.pickBlend('overlay')}>
              {t('Importar overlay da galeria')}
            </button>
          )}
        </>
      )}

      {tab === 'Molduras' && (
        <>
          {chips(FRAME_STYLES, 'frameStyle')}
          {a.frameStyle > 0 && (
            <>
              {slider('frameThickness', t('Espessura'), 0, 100)}
              {a.frameStyle === 2 && slider('frameRadius', t('Raio'), 0, 100)}
              <div className="panel-head">{t('Cor')}</div>
              <Swatches options={FRAME_COLORS} value={info.frameColor} onPick={(frameColor) => session.setColors({ frameColor })} />
              {a.frameStyle === 4 && (
                <>
                  <div className="panel-head">{t('Cor do degradê')}</div>
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
          {slider('lightIntensity', t('Intensidade'), 0, 100)}
          <div className="chips">
            <button className={`chip${lightEdit ? ' on' : ''}`} onClick={() => onLightEdit(!lightEdit)}>
              <Icon name="sun" size={14} /> {lightEdit ? t('Posicionando luz') : t('Posicionar luz')}
            </button>
          </div>
          {lightEdit && <div className="muted">{t('Arraste o ponto na foto para posicionar a luz.')}</div>}
        </>
      )}

      {tab === 'Dupla exposição' && (
        <>
          {info.doubleExposure ? (
            <>
              <Picked session={session} picture={info.doubleExposure} onClear={() => session.clearBlend('doubleExposure')} />
              {chips(BLEND_MODE_LABELS, 'doubleExposureBlend')}
              {slider('doubleExposureOpacity', t('Opacidade'), 0, 100)}
            </>
          ) : (
            <button className="chip" onClick={() => void session.pickBlend('doubleExposure')}>
              {t('Escolher imagem da galeria')}
            </button>
          )}
        </>
      )}
    </>
  );
}

function Picked({ session, picture, onClear }: { session: PhotoSession; picture: PictureRef; onClear: () => void }) {
  // Drawn from the small copy the preview already holds: an <img> of the file decodes the original.
  const thumb = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (thumb.current) void session.drawPictureThumb(thumb.current, picture);
  }, [session, picture]);
  return (
    <div className="picked">
      <canvas ref={thumb} width={64} height={64} />
      <span className="picked-name">{picture.name}</span>
      <button className="icon-btn" onClick={onClear} aria-label={t('Remover imagem')}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
