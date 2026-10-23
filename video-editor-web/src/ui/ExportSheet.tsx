import { useRef, useState } from 'react';
import type { EditorSession } from '../application/session';
import { frameSize } from '../domain/format';
import { formatTimecode } from '../domain/frameMath';
import { GIF_COLOR_OPTIONS, GIF_FPS_OPTIONS, GIF_MAX_DURATION_MS } from '../domain/gifPlan';
import type { ExportOutcome } from '../engine/exporter';
import { useStore } from '../state/useStore';

const RESOLUTIONS = [
  { label: '720p', shortEdge: 720, bitrate: 4_000_000 },
  { label: '1080p', shortEdge: 1080, bitrate: 8_000_000 },
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
  const [res, setRes] = useState(1);
  const [gifSize, setGifSize] = useState(360);
  const [gifFps, setGifFps] = useState<number>(10);
  const [gifColors, setGifColors] = useState<number>(128);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const cancelled = useRef(false);
  const duration = session.durationMs();
  const size = kind === 'mp4' ? frameSize(format, RESOLUTIONS[res].shortEdge) : frameSize(format, gifSize);

  const start = async () => {
    if (duration <= 0) {
      setState({ phase: 'error', message: 'A linha do tempo está vazia.' });
      return;
    }
    cancelled.current = false;
    setState({ phase: 'running', pct: 0 });
    const t0 = performance.now();
    try {
      const out = await session.exportVideo({
        shortEdge: kind === 'mp4' ? RESOLUTIONS[res].shortEdge : gifSize,
        bitrate: RESOLUTIONS[res].bitrate,
        gif: kind === 'gif' ? { fps: gifFps, maxColors: gifColors } : undefined,
        onProgress: (pct) => setState({ phase: 'running', pct }),
        isCancelled: () => cancelled.current,
      });
      setState({ phase: 'done', out, tookMs: performance.now() - t0 });
    } catch (e) {
      const message = String((e as Error)?.message ?? e);
      setState(message === 'CANCELLED' ? { phase: 'idle' } : { phase: 'error', message });
    }
  };

  const running = state.phase === 'running';
  return (
    <div className="sheet-veil" onClick={() => !running && onClose()}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">Exportar</div>
        <div className="chips">
          {(['mp4', 'gif'] as const).map((k) => (
            <button key={k} className={`chip${kind === k ? ' on' : ''}`} disabled={running} onClick={() => setKind(k)}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>
        {kind === 'mp4' ? (
          <div className="chips">
            {RESOLUTIONS.map((r, i) => (
              <button key={r.label} className={`chip${res === i ? ' on' : ''}`} disabled={running} onClick={() => setRes(i)}>
                {r.label}
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
                  {c} cores
                </button>
              ))}
            </div>
            {duration > GIF_MAX_DURATION_MS && <p className="muted">O GIF leva só os primeiros 15 s.</p>}
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
              Cancelar
            </button>
          </>
        )}
        {state.phase === 'done' && (
          <p>
            Pronto: {(state.out.bytes / 1024 / 1024).toFixed(2)} MB em {(state.tookMs / 1000).toFixed(1)} s
            <br />
            <span className="muted">{state.out.path}</span>
          </p>
        )}
        {state.phase === 'error' && <p style={{ color: 'var(--perigo)' }}>{state.message}</p>}
        {!running && (
          <button className="primary-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => void start()}>
            EXPORTAR
          </button>
        )}
      </div>
    </div>
  );
}
