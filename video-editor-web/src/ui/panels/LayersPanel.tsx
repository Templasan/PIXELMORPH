import type { EditorSession } from '../../application/session';
import { TRACK_BLENDS, clipMedia, type Track, type TrackBlend } from '../../domain/Track';
import { addPictureTrack, shiftTrack } from '../../domain/timeline';
import { useStore } from '../../state/useStore';
import { Icon } from '../Icon';
import { displayOrder } from '../trackOrder';
import { t } from '../../i18n';

/** What a track holds, in a few words. */
function contents(track: Track): string {
  const count = (kind: Track['kind']) => track.clips.filter((c) => clipMedia(track, c) === kind).length;
  const parts = (
    [
      [count('video'), 'vídeo', 'vídeos'],
      [count('image'), 'foto', 'fotos'],
      [count('text'), 'texto', 'textos'],
      [count('audio'), 'áudio', 'áudios'],
    ] as const
  ).filter(([n]) => n);
  return parts.map(([n, one, many]) => `${n} ${t(n === 1 ? one : many)}`).join(' · ') || t('Vazia');
}

/**
 * Camadas: every track as a layer, like a mixer: order, visibility, lock, opacity and blend of the
 * whole track. The buttons add media on a new track above everything, so it stacks over what the
 * playhead is on.
 */
export function LayersPanel({
  session,
  onAdd,
  onClose,
}: {
  session: EditorSession;
  onAdd: (kind: 'video' | 'image') => void;
  onClose: () => void;
}) {
  const { editor } = session;
  const tracks = useStore(editor.store, (s) => s.tracks);
  const activeId = useStore(editor.store, (s) => s.activeTrackId);
  const active = tracks.find((tr) => tr.id === activeId);
  const pictureTracks = tracks.filter((tr) => tr.kind !== 'audio').length;
  const patch = (fields: Partial<Track>) =>
    (before: Track[]) => before.map((tr) => (tr.id === activeId ? { ...tr, ...fields } : tr));
  const remove = (track: Track) => {
    editor.commit((before) => before.filter((tr) => tr.id !== track.id));
    editor.setActiveTrack(null);
    editor.clearSelection();
  };
  // The last picture track stays: a timeline without one has nowhere to put a video.
  const canRemove = !!active && !active.locked && (active.kind === 'audio' || pictureTracks > 1);
  return (
    <section className="panel">
      <div className="panel-head">
        {t('Camadas')}
        <button className="icon-btn" onClick={onClose} aria-label={t('Fechar')}>
          <Icon name="check" size={18} />
        </button>
      </div>
      <div className="chips">
        <button className="chip" onClick={() => onAdd('video')}><Icon name="plus" size={14} /> {t('Vídeo')}</button>
        <button className="chip" onClick={() => onAdd('image')}><Icon name="plus" size={14} /> {t('Foto')}</button>
        <button className="chip" onClick={() => session.addText(true)}><Icon name="plus" size={14} /> {t('Texto')}</button>
        <button className="chip" onClick={() => editor.commit((before) => addPictureTrack(before))}><Icon name="plus" size={14} /> {t('Faixa vazia')}</button>
      </div>
      <div className="layer-list">
        {displayOrder(tracks).map((track) => (
          <div
            key={track.id}
            className={`layer-row${track.id === activeId ? ' on' : ''}`}
            onClick={() => editor.setActiveTrack(track.id === activeId ? null : track.id)}
          >
            <button
              className={`row-btn${track.visible ? '' : ' off'}`}
              aria-label={track.visible ? t('Esconder faixa') : t('Mostrar faixa')}
              onClick={(e) => {
                e.stopPropagation();
                editor.toggleVisible(track.id);
              }}
            >
              <Icon name="eye" size={15} />
            </button>
            <div className={`layer-name${track.visible ? '' : ' dim'}`}>
              <div>{track.name}</div>
              <div className="muted">{contents(track)}</div>
            </div>
            <button
              className={`row-btn${track.locked ? '' : ' off'}`}
              aria-label={track.locked ? t('Destravar faixa') : t('Travar faixa')}
              onClick={(e) => {
                e.stopPropagation();
                editor.toggleLocked(track.id);
              }}
            >
              <Icon name="lock" size={14} />
            </button>
            <button
              className="row-btn"
              aria-label={t('Subir faixa')}
              onClick={(e) => {
                e.stopPropagation();
                editor.commit((before) => shiftTrack(before, track.id, 1));
              }}
            >
              ▲
            </button>
            <button
              className="row-btn"
              aria-label={t('Descer faixa')}
              onClick={(e) => {
                e.stopPropagation();
                editor.commit((before) => shiftTrack(before, track.id, -1));
              }}
            >
              ▼
            </button>
          </div>
        ))}
      </div>
      {active && active.kind !== 'audio' && (
        <>
          <div className="field">
            <label>
              <span>{t('Opacidade da faixa')}</span>
              <span>{active.opacity ?? 100}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              disabled={active.locked}
              value={active.opacity ?? 100}
              onChange={(e) => editor.live(patch({ opacity: Number(e.target.value) }))}
              onPointerUp={() => editor.endGesture()}
              onKeyUp={() => editor.endGesture()}
              onBlur={() => editor.endGesture()}
            />
          </div>
          <div className="chips">
            {TRACK_BLENDS.map((b) => (
              <button
                key={b.id}
                disabled={active.locked}
                className={`chip${(active.blend ?? 'source-over') === b.id ? ' on' : ''}`}
                onClick={() => editor.commit(patch({ blend: b.id as TrackBlend }))}
              >
                {t(b.name)}
              </button>
            ))}
          </div>
        </>
      )}
      {active && (
        <button className="chip" disabled={!canRemove} onClick={() => remove(active)}>
          <Icon name="trash" size={14} /> {t('Excluir faixa')}
        </button>
      )}
      <p className="muted">{t('Com uma faixa marcada, Vídeo e Foto entram nela. A faixa de cima cobre as de baixo.')}</p>
    </section>
  );
}
