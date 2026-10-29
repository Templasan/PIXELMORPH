import { useState } from 'react';
import type { ExportFormat, ExportOptions, ExportResult, PhotoSession } from '../application/session';
import { SIZE_PRESETS, SOCIAL_PRESETS, formatBytes, watermarkShadow } from '../domain/export/exportMath';
import { useStore } from '../state/useStore';
import { Chips, Range } from './controls';

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'jpeg', label: 'JPEG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WebP' },
  { id: 'heic', label: 'HEIC' },
];
const DPI_OPTIONS = [72, 150, 300, 600];
/** The 3x3 watermark grid, row by row: 0 top-left ... 8 bottom-right. */
const GLYPHS = ['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'];
/** Flex alignment of the grid's rows (justify) and columns (align) in the preview. */
const ALIGN = ['flex-start', 'center', 'flex-end'] as const;
const CELLS = GLYPHS.map((_, i) => i);
/** The preview's shadow, in em, is the export's shadow scaled to the font size. */
const SHADOW = watermarkShadow(1);

/** Exportar (US-30): the finished picture, with the size, social, target size, DPI and watermark options. */
export function ExportSheet({ session, onClose }: { session: PhotoSession; onClose: () => void }) {
  const info = useStore(session.info);
  const o = useStore(session.exportOptions);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = info.busy !== null;
  const { watermark: wm } = o;

  const set = (patch: Partial<ExportOptions>) => session.exportOptions.set((prev) => ({ ...prev, ...patch }));
  const setWm = (patch: Partial<ExportOptions['watermark']>) => set({ watermark: { ...wm, ...patch } });

  const run = async () => {
    setResult(null);
    setError(null);
    try {
      setResult(await session.exportImage());
    } catch (e) {
      setError(`Falhou: ${e instanceof Error ? e.message : String(e)}`);
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

        <div className="sub">Formato</div>
        <Chips
          options={FORMATS.filter((f) => f.id !== 'heic' || info.canHeic).map((f) => f.id)}
          value={o.format}
          label={(id) => FORMATS.find((f) => f.id === id)!.label}
          onPick={(format) => set({ format })}
        />

        {(o.format === 'jpeg' || o.format === 'png') && (
          <>
            <div className="sub">DPI</div>
            <Chips options={DPI_OPTIONS} value={o.dpi} onPick={(dpi) => set({ dpi })} />
          </>
        )}

        {o.format !== 'png' && (
          <>
            <div className="sub">Compressão</div>
            {o.format !== 'heic' && (
              <label className="toggle">
                <input type="checkbox" checked={o.targetOn} onChange={(e) => set({ targetOn: e.target.checked })} />
                Compressão inteligente
              </label>
            )}
            {o.targetOn && o.format !== 'heic' ? (
              <Range
                label="Tamanho alvo"
                value={o.targetMB}
                min={0.5}
                max={10}
                step={0.5}
                format={(v) => `${v.toFixed(1)} MB`}
                onChange={(targetMB) => set({ targetMB })}
              />
            ) : (
              <Range
                label="Qualidade"
                value={o.quality}
                min={10}
                max={100}
                format={(v) => `${Math.round(v)}%`}
                onChange={(quality) => set({ quality })}
              />
            )}
          </>
        )}

        <div className="sub">Tamanho</div>
        <Chips
          options={SIZE_PRESETS.map((s) => s.name)}
          value={o.social ? null : o.sizePreset}
          onPick={(sizePreset) => set({ sizePreset, social: null })}
        />

        <div className="sub">Redes sociais (recorte)</div>
        <Chips
          options={SOCIAL_PRESETS.map((p) => p.name)}
          value={o.social}
          label={(name) => {
            const p = SOCIAL_PRESETS.find((s) => s.name === name)!;
            return (
              <>
                {p.name} <span className="mono">{p.width}×{p.height}</span>
              </>
            );
          }}
          onPick={(name) => set({ social: o.social === name ? null : name })}
        />

        <div className="sub">Marca d'água</div>
        <div className="field">
          <input
            type="text"
            value={wm.text}
            maxLength={60}
            placeholder="Seu nome ou @perfil"
            autoComplete="off"
            onChange={(e) => setWm({ text: e.target.value })}
          />
        </div>
        <div
          className="wm-preview"
          style={{ justifyContent: ALIGN[Math.floor(wm.position / 3)], alignItems: ALIGN[wm.position % 3] }}
        >
          <span
            style={{
              fontSize: `${(wm.size / 400) * 100}cqw`,
              opacity: wm.opacity / 100,
              transform: `rotate(${wm.rotation}deg)`,
              textShadow: `${SHADOW.offset}em ${SHADOW.offset}em ${SHADOW.blur}em rgba(0, 0, 0, ${SHADOW.alpha})`,
            }}
          >
            {wm.text.trim() || 'Seu texto'}
          </span>
        </div>
        <div className="wm-grid">
          <Chips options={CELLS} value={wm.position} label={(i) => GLYPHS[i]} onPick={(position) => setWm({ position })} />
        </div>
        <Range label="Opacidade" value={wm.opacity} min={0} max={100} format={(v) => `${Math.round(v)}%`} onChange={(opacity) => setWm({ opacity })} />
        <Range label="Tamanho" value={wm.size} min={5} max={80} onChange={(size) => setWm({ size })} />
        <Range label="Rotação" value={wm.rotation} min={-180} max={180} format={(v) => `${Math.round(v)}°`} onChange={(rotation) => setWm({ rotation })} />

        <button className="primary-btn wide" disabled={busy} onClick={run}>
          {busy ? 'Exportando…' : 'Exportar'}
        </button>
        {error && <div className="muted">{error}</div>}
        {result && (
          <div className="muted">
            {FORMATS.find((f) => f.id === result.format)!.label} · {result.width}×{result.height}
            {result.bytes !== null && ` · ${formatBytes(result.bytes)}`}
            {result.quality !== null && ` · qualidade ${result.quality}%`}
            {result.overTarget && ' · acima do alvo (qualidade mínima)'}
            <br />
            {result.where}
          </div>
        )}
      </div>
    </div>
  );
}
