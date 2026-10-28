import { useState } from 'react';
import type { ExportFormat, PhotoSession } from '../application/session';
import { useStore } from '../state/useStore';
import { Chips } from './controls';

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'jpeg', label: 'JPEG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WebP' },
];
const SCALES = [100, 50, 25] as const;

/** Exportar (US-30): the finished picture at the original's resolution (or a fraction of it). */
export function ExportSheet({ session, onClose }: { session: PhotoSession; onClose: () => void }) {
  const info = useStore(session.info);
  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [quality, setQuality] = useState(85);
  const [scale, setScale] = useState<(typeof SCALES)[number]>(100);
  const [result, setResult] = useState<string | null>(null);
  const busy = info.busy !== null;
  const w = info.photo?.width;
  const h = info.photo?.height;

  const run = async () => {
    setResult(null);
    try {
      setResult(await session.exportImage(format, quality / 100, scale / 100));
    } catch (e) {
      setResult(`Falhou: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="sheet-veil" onClick={() => !busy && onClose()}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span>Exportar foto</span>
          <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Fechar">
            ✕
          </button>
        </div>
        <Chips
          options={FORMATS.map((f) => f.id)}
          value={format}
          label={(id) => FORMATS.find((f) => f.id === id)!.label}
          onPick={setFormat}
        />
        {format !== 'png' && (
          <div className="field">
            <label>
              <span>Qualidade</span>
              <span>{quality}%</span>
            </label>
            <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
          </div>
        )}
        <Chips
          options={SCALES}
          value={scale}
          label={(s) => (w && h ? `${Math.round((w * s) / 100)}×${Math.round((h * s) / 100)}` : `${s}%`)}
          onPick={setScale}
        />
        <button className="primary-btn wide" disabled={busy} onClick={run}>
          {busy ? 'Exportando…' : 'Exportar'}
        </button>
        {result && <div className="muted">{result}</div>}
      </div>
    </div>
  );
}
