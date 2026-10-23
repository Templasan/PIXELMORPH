import type { EditorSession } from '../../application/session';
import { findClip } from '../../domain/timeline';
import {
  DEFAULT_TRANSITION_MS,
  TRANSITION_LABELS,
  TRANSITION_TYPES,
  clampTransitionDurationMs,
  effectiveMode,
  previousClipOf,
  setTransition,
  type TransitionType,
} from '../../domain/transitions';
import type { TransitionSpec } from '../../domain/Track';
import { useStore } from '../../state/useStore';
import { Icon } from '../Icon';

/** The transition into `clipId` from the clip just before it on the same track. */
export function TransitionPanel({
  session,
  clipId,
  onClose,
}: {
  session: EditorSession;
  clipId: string;
  onClose: () => void;
}) {
  const { editor } = session;
  const found = useStore(editor.store, (s) => findClip(s.tracks, clipId));
  if (!found) return null;
  const { track, clip } = found;
  const prev = previousClipOf(track, clip);
  const spec = clip.transitionIn;
  const maxMs = prev ? clampTransitionDurationMs(10_000, prev, clip) : 0;
  const apply = (next: TransitionSpec | undefined, live = false) => {
    const fn = (t: Parameters<typeof setTransition>[0]) =>
      setTransition(t, track.id, clip.id, next);
    if (live) editor.live(fn);
    else editor.commit(fn);
  };
  const pick = (type: TransitionType | 'none') =>
    apply(
      type === 'none'
        ? undefined
        : { type, durationMs: Math.min(spec?.durationMs ?? DEFAULT_TRANSITION_MS, maxMs), mode: spec?.mode }
    );
  return (
    <section className="panel">
      <div className="panel-head">
        Transição
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          <Icon name="check" size={18} />
        </button>
      </div>
      <div className="chips">
        {(['none', ...TRANSITION_TYPES] as const).map((t) => (
          <button
            key={t}
            className={`chip${(spec?.type ?? 'none') === t ? ' on' : ''}`}
            onClick={() => pick(t)}
          >
            {t === 'none' ? 'Nenhuma' : TRANSITION_LABELS[t]}
          </button>
        ))}
      </div>
      {spec && (
        <>
          {(spec.type === 'slide' || spec.type === 'wipe') && (
            <div className="chips">
              {(['out', 'in'] as const).map((m) => (
                <button
                  key={m}
                  className={`chip${effectiveMode(spec.type, spec.mode) === m ? ' on' : ''}`}
                  onClick={() => apply({ ...spec, mode: m })}
                >
                  {m === 'out' ? 'Saída (o anterior sai)' : 'Entrada (o novo empurra)'}
                </button>
              ))}
            </div>
          )}
          <div className="field">
            <label>
              <span>Duração</span>
              <span>{(spec.durationMs / 1000).toFixed(2)} s</span>
            </label>
            <input
              type="range"
              min={100}
              max={Math.max(100, maxMs)}
              step={50}
              value={Math.min(spec.durationMs, maxMs)}
              onChange={(e) => apply({ ...spec, durationMs: Number(e.target.value) }, true)}
              onPointerUp={() => editor.endGesture()}
              onBlur={() => editor.endGesture()}
            />
          </div>
          <p className="muted">No máximo metade do clipe mais curto dos dois.</p>
        </>
      )}
    </section>
  );
}
