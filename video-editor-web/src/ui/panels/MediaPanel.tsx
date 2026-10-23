import { useEffect, useState } from 'react';
import type { EditorSession } from '../../application/session';
import type { MediaItem } from '../../ports/host';
import { Icon } from '../Icon';

const TITLES = { video: 'Adicionar vídeo', image: 'Adicionar foto', audio: 'Adicionar áudio' };

export function MediaPanel({
  session,
  kind,
  onClose,
}: {
  session: EditorSession;
  kind: MediaItem['kind'];
  onClose: () => void;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    session.host
      .pickMedia(kind)
      .then((list) => alive && setItems(list))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [session, kind]);
  return (
    <section className="panel">
      <div className="panel-head">
        {TITLES[kind]}
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          <Icon name="x" size={18} />
        </button>
      </div>
      {!items && <p className="muted">Carregando…</p>}
      {items?.length === 0 && <p className="muted">Nenhum arquivo deste tipo.</p>}
      <div className="media-grid">
        {items?.map((m) => (
          <button
            key={m.uri}
            className="media-item"
            onClick={() => {
              onClose();
              void session.addMedia(m);
            }}
          >
            {m.name}
          </button>
        ))}
      </div>
    </section>
  );
}
