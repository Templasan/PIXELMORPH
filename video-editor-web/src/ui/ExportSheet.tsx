import { useEffect, useRef, useState } from 'react';
import type { EditorSession } from '../application/session';
import { frameSize } from '../domain/format';
import { presetFrame, SOCIAL_PRESETS } from '../domain/exportPreset';
import { formatTimecode } from '../domain/frameMath';
import { GIF_COLOR_OPTIONS, GIF_FPS_OPTIONS, GIF_MAX_DURATION_MS } from '../domain/gifPlan';
import type { ExportOutcome } from '../engine/exporter';
import { useStore } from '../state/useStore';
import type { ProjectFormat } from '../ports/host';
import { language, t } from '../i18n';

type Frame = { width: number; height: number; cover: boolean };

/** The mp4 outputs: resolutions in the project's shape, then social presets (their own size). */
const OUTPUTS: { label: string; bitrate: number; frame: (format: ProjectFormat) => Frame }[] = [
  { label: '720p', bitrate: 4_000_000, frame: (f) => ({ ...frameSize(f, 720), cover: false }) },
  { label: '1080p', bitrate: 8_000_000, frame: (f) => ({ ...frameSize(f, 1080), cover: false }) },
  ...SOCIAL_PRESETS.map((p) => ({ label: p.label, bitrate: p.bitrate, frame: (f: ProjectFormat) => presetFrame(p, f) })),
];
/**
 * RF-021: the whole 360 picture, 2:1, marked so players open it as 360.
 * shortcut: 1920x960 is what the encoder's H.264 level allows; 4K needs a higher level and a phone test.
 */
const SPHERE_OUTPUT = { label: '360°', bitrate: 12_000_000, frame: () => ({ width: 1920, height: 960, cover: true }) };
const GIF_SIZES = [240, 360, 480];

type State =
  | { phase: 'idle' }
  | { phase: 'running'; pct: number }
  | { phase: 'done'; out: ExportOutcome; tookMs: number }
  | { phase: 'error'; message: string };

export function ExportSheet({ session, onClose }: { session: EditorSession; onClose: () => void }) {
  const format = useStore(session.format);
  const [kind, setKind] = useState<'mp4' | 'gif'>('mp4');
  const [out, setOut] = useState(1);
  const has360 = useStore(session.editor.store, (e) =>
    e.tracks.some((track) => track.clips.some((c) => c.spherical && !c.sphericalFlat))
  );
  const outputs = has360 ? [...OUTPUTS, SPHERE_OUTPUT] : OUTPUTS;
  const [gifSize, setGifSize] = useState(360);
  const [gifFps, setGifFps] = useState<number>(10);
  const [gifColors, setGifColors] = useState<number>(128);
  const [highlights, setHighlights] = useState(false);
  // Off by default until the analysis cost is under 10% of the export (README, RNF-013).
  const [smart, setSmart] = useState(false);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const cancelled = useRef(false);
  const duration = session.durationMs();
  const size: Frame = kind === 'mp4' ? outputs[out].frame(format) : { ...frameSize(format, gifSize), cover: false };

  const start = async () => {
    if (duration <= 0) {
      setState({ phase: 'error', message: t('A linha do tempo está vazia.') });
      return;
    }
    cancelled.current = false;
    setState({ phase: 'running', pct: 0 });
    const t0 = performance.now();
    try {
      const result = await session.exportVideo({
        frame: size,
        bitrate: outputs[out].bitrate,
        spherical: kind === 'mp4' && outputs[out] === SPHERE_OUTPUT,
        adaptive: kind === 'mp4' && smart,
        gif: kind === 'gif' ? { fps: gifFps, maxColors: gifColors, highlights } : undefined,
        onProgress: (pct) => setState({ phase: 'running', pct }),
        isCancelled: () => cancelled.current,
      });
      setState({ phase: 'done', out: result, tookMs: performance.now() - t0 });
    } catch (e) {
      const message = String((e as Error)?.message ?? e);
      setState(message === 'CANCELLED' ? { phase: 'idle' } : { phase: 'error', message });
    }
  };

  const running = state.phase === 'running';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !running && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, onClose]);
  return (
    <div className="sheet-veil" onClick={() => !running && onClose()}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">{t('Exportar')}</div>
        <div className="chips">
          {(['mp4', 'gif'] as const).map((k) => (
            <button key={k} className={`chip${kind === k ? ' on' : ''}`} disabled={running} onClick={() => setKind(k)}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>
        {kind === 'mp4' ? (
          <div className="chips">
            {outputs.map((o, i) => (
              <button key={o.label} className={`chip${out === i ? ' on' : ''}`} disabled={running} onClick={() => setOut(i)}>
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="chips">
              {GIF_SIZES.map((s) => (
                <button key={s} className={`chip${gifSize === s ? ' on' : ''}`} disabled={running} onClick={() => setGifSize(s)}>
                  {s}p
                </button>
              ))}
            </div>
            <div className="chips">
              <button className={`chip${highlights ? ' on' : ''}`} disabled={running} onClick={() => setHighlights(!highlights)}>
                {t('Miniatura com os melhores momentos')}
              </button>
            </div>
            <div className="chips">
              {GIF_FPS_OPTIONS.map((f) => (
                <button key={f} className={`chip${gifFps === f ? ' on' : ''}`} disabled={running} onClick={() => setGifFps(f)}>
                  {f} fps
                </button>
              ))}
            </div>
            <div className="chips">
              {GIF_COLOR_OPTIONS.map((c) => (
                <button key={c} className={`chip${gifColors === c ? ' on' : ''}`} disabled={running} onClick={() => setGifColors(c)}>
                  {t('{c} cores', { c })}
                </button>
              ))}
            </div>
            {duration > GIF_MAX_DURATION_MS && <p className="muted">{t('O GIF leva só os primeiros 15 s.')}</p>}
          </>
        )}
        {kind === 'mp4' && (
          <label className="muted">
            <input type="checkbox" checked={smart} disabled={running} onChange={(e) => setSmart(e.target.checked)} />{' '}
            {t('Compressão inteligente')}
          </label>
        )}
        <p className="muted">
          {size.width}×{size.height} · {format} · {formatTimecode(duration)}
        </p>
        {state.phase === 'running' && (
          <>
            <div className="progress">
              <div style={{ width: `${state.pct}%` }} />
            </div>
            <button className="chip" onClick={() => (cancelled.current = true)}>
              {t('Cancelar')}
            </button>
          </>
        )}
        {state.phase === 'done' && (
          <p>
            {t('Pronto: {mb} MB em {s} s', { mb: (state.out.bytes / 1024 / 1024).toFixed(2), s: (state.tookMs / 1000).toFixed(1) })}
            {state.out.smart && (
              <>
                <br />
                {t('Compressão inteligente: {mbps} Mbps ({pct}% do preset)', {
                  mbps: new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(state.out.smart.bitrate / 1e6),
                  pct: Math.round((state.out.smart.bitrate / state.out.smart.presetBitrate) * 100),
                })}
              </>
            )}
            <br />
            <span className="muted">{state.out.path}</span>
            {state.out.silent.length > 0 && (
              <>
                <br />
                <span style={{ color: 'var(--alerta)' }}>
                  {t('O som de {n} arquivo(s) não pôde ser lido neste aparelho e ficou de fora.', { n: state.out.silent.length })}
                </span>
              </>
            )}
          </p>
        )}
        {state.phase === 'error' && <p style={{ color: 'var(--perigo)' }}>{state.message}</p>}
        {!running && (
          <button className="primary-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => void start()}>
            {t('EXPORTAR')}
          </button>
        )}
      </div>
    </div>
  );
}
