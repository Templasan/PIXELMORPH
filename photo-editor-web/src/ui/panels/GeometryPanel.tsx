import { t } from '../../i18n';
import type { PhotoSession } from '../../application/session';
import { DEFAULT_ADJUSTMENTS, PERSPECTIVE_FIELDS } from '../../domain/adjustments';
import { useStore } from '../../state/useStore';
import { Chips, commit, FieldSlider } from '../controls';

const TURNS = [0, 90, 180, 270] as const;

/** Geometria (US-05): quarter turns, mirror, straighten and 4-point perspective. */
export function GeometryPanel({
  session,
  perspective,
  onPerspective,
}: {
  session: PhotoSession;
  perspective: boolean;
  onPerspective: (on: boolean) => void;
}) {
  const a = useStore(session.editor.store, (s) => s.adjustments);
  const reset = () => {
    for (const f of PERSPECTIVE_FIELDS) commit(session, f, DEFAULT_ADJUSTMENTS[f]);
  };
  return (
    <>
      <Chips options={TURNS} value={a.rotation90} label={(d) => `${d}°`} onPick={(d) => commit(session, 'rotation90', d)} />
      <div className="chips">
        <button className={`chip${a.flipH > 0 ? ' on' : ''}`} onClick={() => commit(session, 'flipH', a.flipH > 0 ? 0 : 1)}>
          {t('Espelhar H')}
        </button>
        <button className={`chip${a.flipV > 0 ? ' on' : ''}`} onClick={() => commit(session, 'flipV', a.flipV > 0 ? 0 : 1)}>
          {t('Espelhar V')}
        </button>
      </div>
      <FieldSlider session={session} field="fineRotation" label={t('Rotação')} min={-45} max={45} step={0.5} format={(v) => `${v}°`} />
      <FieldSlider session={session} field="mirrorOpacity" label={t('Opac. espelho')} min={0} max={100} />
      <div className="chips">
        <button className={`chip${perspective ? ' on' : ''}`} onClick={() => onPerspective(!perspective)}>
          {perspective ? t('Editando perspectiva') : t('Corrigir perspectiva')}
        </button>
        {perspective && (
          <button className="chip" onClick={reset}>
            {t('Redefinir')}
          </button>
        )}
        {perspective && (
          <button
            className="chip"
            title={t('Aplica a correção na foto e começa do zero')}
            onClick={() => void session.bake(PERSPECTIVE_FIELDS).then(() => onPerspective(false))}
          >
            ✓ {t('Aplicar')}
          </button>
        )}
      </div>
      {perspective && <div className="muted">{t('Arraste os quatro pontos na foto para endireitar linhas distorcidas.')}</div>}
    </>
  );
}
