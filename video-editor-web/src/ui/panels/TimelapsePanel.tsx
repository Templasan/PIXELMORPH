import { useState } from 'react';
import type { EditorSession } from '../../application/session';
import { TIMELAPSE_SECONDS } from '../../domain/timelapse';
import { TRANSITION_LABELS, TRANSITION_TYPES, type TransitionType } from '../../domain/transitions';
import type { MediaItem } from '../../ports/host';
import { Icon } from '../Icon';
import { t } from '../../i18n';

/** RF-023: several photos at the playhead, each for the chosen time, in the order they were picked. */
export function TimelapsePanel({ session, onClose }: { session: EditorSession; onClose: () => void }) {
  const [secs, setSecs] = useState(0.5);
  const [transition, setTransition] = useState<TransitionType | 'none'>('none');
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [picked, setPicked] = useState<MediaItem[]>([]);
  const add = (list: MediaItem[]) => {
    onClose();
    session.addTimelapse(list, {
      secondsPerPhoto: secs,
      transition: transition === 'none' ? undefined : transition,
    });
  };
  const choose = () =>
    session.host
      .pickMedia('image', true)
      .then((list) => (session.host.pickIsFinal ? add(list) : setItems(list)))
      .catch((e) => session.error.set(String((e as Error)?.message ?? e)));
  const toggle = (m: MediaItem) =>
    setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));

  return (
    <section className="panel">
      <div className="panel-head">
        {t('Time-lapse')}
        <button className="icon-btn" onClick={onClose} aria-label={t('Fechar')}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div className="field">
        <label>
          <span>{t('Segundos por foto')}</span>
          <span>{secs.toFixed(1)} s</span>
        </label>
        <input
          type="range"
          min={TIMELAPSE_SECONDS.min}
          max={TIMELAPSE_SECONDS.max}
          step={TIMELAPSE_SECONDS.step}
          value={secs}
          onChange={(e) => setSecs(Number(e.target.value))}
        />
      </div>
      <div className="chips">
        {(['none', ...TRANSITION_TYPES] as const).map((kind) => (
          <button key={kind} className={`chip${transition === kind ? ' on' : ''}`} onClick={() => setTransition(kind)}>
            {kind === 'none' ? t('Sem transição') : t(TRANSITION_LABELS[kind])}
          </button>
        ))}
      </div>
      {!items && (
        <button className="primary-btn" style={{ width: '100%' }} onClick={() => void choose()}>
          {t('Escolher fotos')}
        </button>
      )}
      {items && (
        <>
          <div className="media-grid">
            {items.map((m) => {
              const n = picked.indexOf(m) + 1;
              return (
                <button key={m.uri} className={`media-item${n ? ' on' : ''}`} onClick={() => toggle(m)}>
                  {n ? `${n}. ` : ''}
                  {m.name}
                </button>
              );
            })}
          </div>
          <button className="primary-btn" style={{ width: '100%' }} disabled={picked.length === 0} onClick={() => add(picked)}>
            {t(picked.length === 1 ? 'Adicionar 1 foto' : 'Adicionar {n} fotos', { n: picked.length })}
          </button>
        </>
      )}
      <p className="muted">
        {t('As fotos entram em ordem a partir do cursor, na faixa de imagens. Para a música, use a faixa Áudio.')}
      </p>
    </section>
  );
}
