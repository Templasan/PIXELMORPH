import { useEffect, useRef, useState } from 'react';
import type { EditorSession } from '../application/session';
import { frameSize } from '../domain/format';
import { presetFrame, SOCIAL_PRESETS } from '../domain/exportPreset';
import { formatTimecode } from '../domain/frameMath';
import { GIF_COLOR_OPTIONS, GIF_FPS_OPTIONS, GIF_MAX_DURATION_MS } from '../domain/gifPlan';
import type { ExportOutcome } from '../engine/exporter';
import { useStore } from '../state/useStore';
import type { ProjectFormat } from '../ports/host';
import { t } from '../i18n';

type Frame = { width: number; height: number; cover: boolean };

/** The mp4 outputs: resolutions in the project's shape, then social presets (their own size). */
const OUTPUTS: { label: string; bitrate: number; frame: (format: ProjectFormat) => Frame }[] = [
  { label: '720p', bitrate: 4_000_000, frame: (f) => ({ ...frameSize(f, 720), cover: false }) },
  { label: '1080p', bitrate: 8_000_000, frame: (f) => ({ ...frameSize(f, 1080), cover: false }) },
  ...SOCIAL_PRESETS.map((p) => ({ label: p.label, bitrate: p.bitrate, frame: (f: ProjectFormat) => presetFrame(p, f) })),
];
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
  const [gifSize, setGifSize] = useState(360);
  const [gifFps, setGifFps] = useState<number>(10);
  const [gifColors, setGifColors] = useState<number>(128);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const cancelled = useRef(false);
  const duration = session.durationMs();
  const size: Frame = kind === 'mp4' ? OUTPUTS[out].frame(format) : { ...frameSize(format, gifSize), cover: false };

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
        bitrate: OUTPUTS[out].bitrate,
        gif: kind === 'gif' ? { fps: gifFps, maxColors: gifColors } : undefined,
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
            {OUTPUTS.map((o, i) => (
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
