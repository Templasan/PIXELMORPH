import { useEffect, useRef, useState } from 'react';
import type { EditorSession } from '../application/session';
import { selectedClipOf } from '../application/videoEditorStore';
import { stepFrameMs } from '../domain/frameMath';
import { useStore } from '../state/useStore';
import { ExportSheet } from './ExportSheet';
import { Icon } from './Icon';
import { ClipPanel, type ClipTool } from './panels/ClipPanel';
import { MediaPanel } from './panels/MediaPanel';
import { TransitionPanel } from './panels/TransitionPanel';
import { Timeline } from './Timeline';
import { PROJECT_FORMATS } from '../domain/format';

type Panel =
  | { kind: 'none' }
  | { kind: 'media'; media: 'video' | 'image' | 'audio' }
  | { kind: 'clip'; tool: ClipTool }
  | { kind: 'transition'; clipId: string }
  | { kind: 'format' };

export function App({ session }: { session: EditorSession }) {
  const { editor } = session;
  const name = useStore(session.projectName);
  const history = useStore(session.historyState);
  const selection = useStore(editor.store, (s) => selectedClipOf(s));
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [exporting, setExporting] = useState(false);

  // A panel about the selected clip closes when the selection goes away.
  useEffect(() => {
    if (!selection && panel.kind === 'clip') setPanel({ kind: 'none' });
  }, [selection, panel.kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Text fields keep their own keys; a slider keeps focus after a drag but must not block undo.
      if ((e.target as HTMLElement).closest('textarea, input:not([type="range"])')) return;
      if ((e.target as HTMLElement).closest('input[type="range"]') && !(e.ctrlKey || e.metaKey)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        session.toggle();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        session.deleteSelected();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        session.pause();
        session.seek(stepFrameMs(session.time.get(), e.key === 'ArrowLeft' ? -1 : 1, session.durationMs()));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, editor]);

  return (
    <div className="editor">
      <header className="topbar">
        <button className="icon-btn" onClick={() => session.host.close()} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <div className="title">{name}</div>
        <button className="icon-btn" disabled={!history.canUndo} onClick={() => editor.undo()} aria-label="Desfazer">
          <Icon name="undo" size={20} />
        </button>
        <button className="icon-btn" disabled={!history.canRedo} onClick={() => editor.redo()} aria-label="Refazer">
          <Icon name="redo" size={20} />
        </button>
        <button className="primary-btn" onClick={() => setExporting(true)}>
          EXPORTAR
        </button>
      </header>

      <Preview session={session} />
      <Transport session={session} />
      <Timeline session={session} onTransition={(clipId) => setPanel({ kind: 'transition', clipId })} />

      {panel.kind === 'media' && (
        <MediaPanel session={session} kind={panel.media} onClose={() => setPanel({ kind: 'none' })} />
      )}
      {panel.kind === 'clip' && selection && (
        <ClipPanel session={session} tool={panel.tool} onClose={() => setPanel({ kind: 'none' })} />
      )}
      {panel.kind === 'transition' && (
        <TransitionPanel session={session} clipId={panel.clipId} onClose={() => setPanel({ kind: 'none' })} />
      )}
      {panel.kind === 'format' && <FormatPanel session={session} onClose={() => setPanel({ kind: 'none' })} />}
      {panel.kind === 'none' && (
        <Toolbar
          session={session}
          onFormat={() => setPanel({ kind: 'format' })}
          onMedia={(media) =>
            session.host.pickIsFinal
              ? void session.host
                  .pickMedia(media)
                  .then(async (items) => {
                    for (const item of items) await session.addMedia(item);
                  })
                  .catch((e) => session.error.set(String((e as Error)?.message ?? e)))
              : setPanel({ kind: 'media', media })
          }
          onTool={(tool) => setPanel({ kind: 'clip', tool })}
        />
      )}
      {exporting && <ExportSheet session={session} onClose={() => setExporting(false)} />}
    </div>
  );
}

function Preview({ session }: { session: EditorSession }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const error = useStore(session.error);
  const busy = useStore(session.busy);
  useEffect(() => {
    session.attach(canvasRef.current!);
    return () => session.detach();
  }, [session]);
  return (
    <div className="preview" onClick={() => session.toggle()}>
      <canvas ref={canvasRef} />
      {(error || busy) && (
        <div className="toast" onClick={(e) => (e.stopPropagation(), session.error.set(null))}>
          {busy ?? error}
        </div>
      )}
    </div>
  );
}

/** m:ss.cc — short enough for a phone's transport bar. */
export function shortTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 10));
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function Transport({ session }: { session: EditorSession }) {
  const playing = useStore(session.playing);
  const time = useStore(session.time);
  const tracks = useStore(session.editor.store, (s) => s.tracks);
  void tracks; // the total follows the timeline
  const total = session.durationMs();
  const step = (dir: 1 | -1) => {
    session.pause();
    session.seek(stepFrameMs(session.time.get(), dir, total));
  };
  return (
    <div className="transport">
      <span className="timecode">{shortTime(time)}</span>
      <div className="buttons">
        <button className="icon-btn" onClick={() => (session.pause(), session.seek(0))} aria-label="Início">
          <Icon name="skipBack" size={18} />
        </button>
        <button className="icon-btn step" onClick={() => step(-1)} aria-label="Quadro anterior">
          <Icon name="stepBack" size={18} />
        </button>
        <button className="play-btn" onClick={() => session.toggle()} aria-label={playing ? 'Pausar' : 'Reproduzir'}>
          <Icon name={playing ? 'pause' : 'play'} size={20} />
        </button>
        <button className="icon-btn step" onClick={() => step(1)} aria-label="Próximo quadro">
          <Icon name="stepFwd" size={18} />
        </button>
        <button className="icon-btn" onClick={() => (session.pause(), session.seek(total))} aria-label="Fim">
          <Icon name="skipFwd" size={18} />
        </button>
      </div>
      <span className="timecode total">{shortTime(total)}</span>
    </div>
  );
}

function FormatPanel({ session, onClose }: { session: EditorSession; onClose: () => void }) {
  const format = useStore(session.format);
  return (
    <section className="panel">
      <div className="panel-head">
        Formato do vídeo
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          <Icon name="check" size={18} />
        </button>
      </div>
      <div className="chips">
        {PROJECT_FORMATS.map((f) => (
          <button key={f.id} className={`chip${format === f.id ? ' on' : ''}`} onClick={() => session.format.set(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="muted">Vídeos de outro formato ficam inteiros com faixas pretas; use Posição → Preencher para cortar.</p>
    </section>
  );
}

function Toolbar({
  session,
  onFormat,
  onMedia,
  onTool,
}: {
  session: EditorSession;
  onFormat: () => void;
  onMedia: (kind: 'video' | 'image' | 'audio') => void;
  onTool: (tool: ClipTool) => void;
}) {
  const { editor } = session;
  const selection = useStore(editor.store, (s) => selectedClipOf(s));
  const time = useStore(session.time);
  if (!selection) {
    return (
      <nav className="toolbar">
        <Tool icon="film" label="Vídeo" onClick={() => onMedia('video')} />
        <Tool icon="image" label="Foto" onClick={() => onMedia('image')} />
        <Tool icon="music" label="Áudio" onClick={() => onMedia('audio')} />
        <Tool icon="type" label="Texto" onClick={() => session.addText()} />
        <Tool icon="crop" label="Formato" onClick={onFormat} />
        <RippleTool session={session} />
      </nav>
    );
  }
  const { track, clip } = selection;
  const inside = time > clip.startMs && time < clip.startMs + (clip.outPointMs - clip.inPointMs) / (clip.speed ?? 1);
  const media = track.kind === 'video' || track.kind === 'image';
  return (
    <nav className="toolbar">
      <Tool icon="scissors" label="Dividir" disabled={!inside || track.locked} onClick={() => editor.split(time)} />
      {track.kind === 'text' && <Tool icon="type" label="Editar" onClick={() => onTool('text')} />}
      {track.kind === 'video' && <Tool icon="speed" label="Velocidade" onClick={() => onTool('speed')} />}
      {(track.kind === 'video' || track.kind === 'audio') && (
        <Tool icon="volume" label="Volume" onClick={() => onTool('volume')} />
      )}
      {media && <Tool icon="sun" label="Cor" onClick={() => onTool('color')} />}
      {media && <Tool icon="maximize" label="Posição" onClick={() => onTool('position')} />}
      {media && <Tool icon="rotate" label="Girar" onClick={() => editor.commitClip((c) => ({ ...c, rotation: (((c.rotation ?? 0) + 90) % 360) }))} />}
      {track.kind === 'video' && (
        <Tool icon="freeze" label="Congelar" disabled={!inside} onClick={() => editor.freeze(time)} />
      )}
      <Tool icon="copy" label="Duplicar" onClick={() => session.duplicateSelected()} />
      <Tool icon="trash" label="Excluir" danger onClick={() => session.deleteSelected()} />
      <RippleTool session={session} />
    </nav>
  );
}

/** Vegas-style auto ripple: trims and deletes move the clips after the edit on the same track. */
function RippleTool({ session }: { session: EditorSession }) {
  const on = useStore(session.editor.store, (s) => s.rippleMode);
  return (
    <button
      className={`tool${on ? ' on' : ''}`}
      aria-pressed={on}
      onClick={() => session.editor.toggleRipple()}
    >
      <Icon name="ripple" />
      Ripple {on ? 'ligado' : 'desligado'}
    </button>
  );
}

function Tool({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button className={`tool${danger ? ' danger' : ''}`} disabled={disabled} onClick={onClick}>
      <Icon name={icon} />
      {label}
    </button>
  );
}
