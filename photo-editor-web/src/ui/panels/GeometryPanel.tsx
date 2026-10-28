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
          Espelhar H
        </button>
        <button className={`chip${a.flipV > 0 ? ' on' : ''}`} onClick={() => commit(session, 'flipV', a.flipV > 0 ? 0 : 1)}>
          Espelhar V
        </button>
      </div>
      <FieldSlider session={session} field="fineRotation" label="Rotação" min={-45} max={45} step={0.5} format={(v) => `${v}°`} />
      <FieldSlider session={session} field="mirrorOpacity" label="Opac. espelho" min={0} max={100} />
      <div className="chips">
        <button className={`chip${perspective ? ' on' : ''}`} onClick={() => onPerspective(!perspective)}>
          {perspective ? 'Editando perspectiva' : 'Corrigir perspectiva'}
        </button>
        {perspective && (
          <button className="chip" onClick={reset}>
            Redefinir
          </button>
        )}
      </div>
      {perspective && <div className="muted">Arraste os quatro pontos na foto para endireitar linhas distorcidas.</div>}
    </>
  );
}
