import { useEffect, useState } from 'react';
import type { EditorSession } from '../application/session';
import { speechErrorText } from '../application/speechCaptions';
import type { SpeechProgress } from '../ports/host';
import { t } from '../i18n';

type Phase =
  | { name: 'checking' }
  | { name: 'ask'; download: boolean }
  | { name: 'running'; progress: SpeechProgress | null }
  | { name: 'none' }
  | { name: 'error'; message: string };

const STAGES: Record<SpeechProgress['stage'], string> = {
  model: 'Baixando o modelo… {n}%',
  audio: 'Lendo o som do clipe…',
  speech: 'Ouvindo a fala… {n}%',
};

/** RF-069: asks before the one download, and shows the work, which can take a while. */
export function CaptionsSheet({ session, clipId, onClose }: { session: EditorSession; clipId: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ name: 'checking' });
  const [elapsed, setElapsed] = useState(0);
  const minutes = session.speechMinutes(clipId);
  const isRunning = phase.name === 'running';
  useEffect(() => {
    if (!isRunning) return;
    const began = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - began) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    let alive = true;
    void session.speechModelReady().then((ready) => {
      if (!alive) return;
      if (ready === null) setPhase({ name: 'error', message: t('Legendas por fala só funcionam no app.') });
      else setPhase({ name: 'ask', download: !ready });
    });
    return () => {
      alive = false;
    };
  }, [session]);

  const start = async () => {
    setPhase({ name: 'running', progress: null });
    try {
      const made = await session.generateCaptions(clipId, (progress) => setPhase({ name: 'running', progress }));
      if (made > 0) onClose();
      else setPhase({ name: 'none' });
    } catch (e) {
      const code = String((e as Error)?.message ?? e);
      if (code === 'CANCELLED') onClose();
      else setPhase({ name: 'error', message: speechErrorText(code) });
    }
  };

  const running = phase.name === 'running';
  return (
    <div className="sheet-veil" onClick={() => !running && onClose()}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">{t('Legendas por fala')}</div>
        {phase.name === 'ask' && (
          <>
            <p className="muted">
              {phase.download
                ? t('Na primeira vez o app baixa o modelo de fala (75 MB). O som do vídeo é ouvido no aparelho e não é enviado.')
                : t('O som do vídeo é ouvido no aparelho e não é enviado.')}
            </p>
            {minutes !== null && <p className="muted">{t('Neste aparelho pode levar cerca de {n} min.', { n: minutes })}</p>}
            <div className="chips">
              <button className="chip on" onClick={() => void start()}>
                {phase.download ? t('Baixar e gerar') : t('Gerar')}
              </button>
              <button className="chip" onClick={onClose}>
                {t('Cancelar')}
              </button>
            </div>
          </>
        )}
        {running && (
          <>
            <p className="muted">
              {phase.progress ? t(STAGES[phase.progress.stage], { n: phase.progress.percent }) : t('Preparando…')}
            </p>
            <p className="muted">
              {t('Tempo: {time}', { time: `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` })}
            </p>
            <div className="chips">
              <button className="chip" onClick={() => session.cancelSpeech()}>
                {t('Cancelar')}
              </button>
            </div>
          </>
        )}
        {phase.name === 'none' && <p className="muted">{t('Não encontrei fala neste clipe.')}</p>}
        {phase.name === 'error' && <p className="muted">{phase.message}</p>}
        {(phase.name === 'none' || phase.name === 'error') && (
          <div className="chips">
            <button className="chip" onClick={onClose}>
              {t('Fechar')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
