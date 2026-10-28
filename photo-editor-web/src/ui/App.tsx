import { useEffect, useState, type ReactNode } from 'react';
import type { PhotoSession } from '../application/session';
import { useStore } from '../state/useStore';
import { ExportSheet } from './ExportSheet';
import { Icon } from './Icon';
import { PhotoView, type ViewMode } from './PhotoView';
import { AdjustPanel } from './panels/AdjustPanel';
import { GeometryPanel } from './panels/GeometryPanel';

const TOOLS = [
  { id: 'ajustes', icon: 'sliders', label: 'Ajustes' },
  { id: 'geometria', icon: 'crop', label: 'Geometria' },
] as const;

function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

export function App({ session }: { session: PhotoSession }) {
  const { editor } = session;
  const info = useStore(session.info);
  const history = useStore(session.history);
  const tool = useStore(editor.store, (s) => s.activeTool);
  const compare = useStore(editor.store, (s) => s.compareMode);
  const [exporting, setExporting] = useState(false);
  const [perspective, setPerspective] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('textarea, input:not([type="range"])')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor]);

  const mode: ViewMode = tool === 'geometria' && perspective ? 'perspective' : 'none';
  let panel: ReactNode = null;
  if (tool === 'ajustes') panel = <AdjustPanel session={session} />;
  else if (tool === 'geometria')
    panel = <GeometryPanel session={session} perspective={perspective} onPerspective={setPerspective} />;

  const p = info.photo;
  return (
    <div className="editor">
      <header className="topbar">
        <button className="icon-btn" onClick={() => session.close()} aria-label="Voltar">
          <Icon name="back" />
        </button>
        <div className="title">{info.name}</div>
        <button className="icon-btn" disabled={history.done.length === 0} onClick={() => editor.undo()} aria-label="Desfazer">
          <Icon name="undo" size={20} />
        </button>
        <button className="icon-btn" disabled={history.undone.length === 0} onClick={() => editor.redo()} aria-label="Refazer">
          <Icon name="redo" size={20} />
        </button>
        <button className={`icon-btn${compare ? ' on' : ''}`} onClick={() => editor.toggleCompare()} aria-label="Comparar">
          <Icon name="compare" size={20} />
        </button>
        <button className="primary-btn" disabled={info.status !== 'ready'} onClick={() => setExporting(true)}>
          EXPORTAR
        </button>
      </header>
      <div className="tech">
        <span>
          {p?.width && p.height ? `${p.width} × ${p.height}` : '…'}
          {p?.format ? ` · ${p.format}` : ''}
        </span>
        <span>{p?.sizeBytes ? formatBytes(p.sizeBytes) : ''}</span>
      </div>
      <PhotoView session={session} mode={mode} />
      {panel && <div className="panel">{panel}</div>}
      <nav className="toolbar">
        {TOOLS.map((t) => (
          <button key={t.id} className={`tool${tool === t.id ? ' on' : ''}`} onClick={() => editor.toggleTool(t.id)}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {info.busy && <div className="toast">{info.busy}</div>}
      {exporting && <ExportSheet session={session} onClose={() => setExporting(false)} />}
    </div>
  );
}
