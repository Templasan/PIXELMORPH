import { t } from '../i18n';
import type { PhotoSession } from '../application/session';
import { Icon } from './Icon';
import { CollageSection, PanoramaPanel } from './panels/MontagePanels';

export type MontageTool = 'collage' | 'panorama';

/** A collage or panorama started from the app's Explore screen: no photo is open yet. */
export function MontageStart({ session, tool }: { session: PhotoSession; tool: MontageTool }) {
  return (
    <div className="editor">
      <header className="topbar">
        <button className="icon-btn" onClick={() => session.close()} aria-label={t('Voltar')}>
          <Icon name="back" />
        </button>
        <div className="title">{tool === 'collage' ? t('Colagem') : t('Panorama')}</div>
      </header>
      <div className="panel" style={{ flex: 1, maxHeight: 'none' }}>
        {tool === 'collage' ? <CollageSection session={session} /> : <PanoramaPanel session={session} />}
      </div>
    </div>
  );
}
