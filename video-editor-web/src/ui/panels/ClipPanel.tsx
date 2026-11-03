import { useState, type ReactNode } from 'react';
import type { EditorSession } from '../../application/session';
import { selectedClipOf } from '../../application/videoEditorStore';
import { applySpeedRamp } from '../../domain/speedRamp';
import { captionName } from '../../application/textEdit';
import {
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  TEXT_ANIMATIONS,
  TEXT_FONTS,
  TEXT_OUTLINE_WIDTH,
  type ClipText,
} from '../../domain/textCaption';
import { TRACK_BLENDS, type Clip, type Track } from '../../domain/Track';
import { useStore } from '../../state/useStore';
import { Icon } from '../Icon';
import { t } from '../../i18n';

export type ClipTool = 'speed' | 'volume' | 'color' | 'position' | 'text' | 'sphere';

const TITLES: Record<ClipTool, string> = {
  speed: 'Velocidade',
  volume: 'Volume',
  color: 'Cor',
  position: 'Posição e tamanho',
  sphere: 'Vídeo 360',
  text: 'Texto',
};
const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];
const RAMP_EDGES = ['start', 'end'] as const;
const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
const TEXT_COLORS = ['#ffffff', '#000000', '#ffd400', '#ff4d4d', '#3a8fde', '#5fb98f'];

/**
 * A slider bound to the selected clip: moving it edits live (one undo entry per drag, closed on
 * release), so the preview follows the finger.
 */
function Slider({
  session,
  label,
  value,
  min,
  max,
  step = 1,
  format = (v) => String(Math.round(v)),
  onLive,
}: {
  session: EditorSession;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onLive: (v: number) => void;
}) {
  const end = () => session.editor.endGesture();
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        <span>{format(value)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onLive(Number(e.target.value))}
        onPointerUp={end}
        onKeyUp={end}
        onBlur={end}
      />
    </div>
  );
}

function Chips<T extends string | number>({
  options,
  value,
  label = (v) => String(v),
  onPick,
}: {
  options: readonly T[];
  value: T;
  label?: (v: T) => ReactNode;
  onPick: (v: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={String(o)} className={`chip${o === value ? ' on' : ''}`} onClick={() => onPick(o)}>
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export function ClipPanel({
  session,
  tool,
  onClose,
}: {
  session: EditorSession;
  tool: ClipTool;
  onClose: () => void;
}) {
  const { editor } = session;
  const selection = useStore(editor.store, (s) => selectedClipOf(s));
  if (!selection) return null;
  const { track, clip } = selection;
  const live = (patch: Partial<Clip>) => editor.liveClip((c) => ({ ...c, ...patch }));
  const commit = (patch: Partial<Clip>) => editor.commitClip((c) => ({ ...c, ...patch }));

  return (
    <section className="panel">
      <div className="panel-head">
        {t(TITLES[tool])}
        <button className="icon-btn" onClick={onClose} aria-label={t('Fechar')}>
          <Icon name="check" size={18} />
        </button>
      </div>

      {tool === 'speed' && (
        <>
          <Chips options={SPEEDS} value={clip.speed ?? 1} label={(v) => `${v}x`} onPick={(v) => editor.setSpeed(v, 'commit')} />
          <Slider
            session={session}
            label={t('Velocidade')}
            value={clip.speed ?? 1}
            min={0.25}
            max={4}
            step={0.05}
            format={(v) => `${v.toFixed(2)}x`}
            onLive={(v) => editor.setSpeed(v, 'live')}
          />
          <p className="muted">{t('Os clipes seguintes desta faixa andam junto para não sobrepor.')}</p>
          <SpeedRamp session={session} track={track} clip={clip} />
        </>
      )}

      {tool === 'volume' && (
        <>
          <Slider session={session} label={t('Volume')} value={clip.volume ?? 100} min={0} max={200} format={(v) => `${Math.round(v)}%`} onLive={(v) => live({ volume: v })} />
          <Slider session={session} label={t('Entrada suave')} value={clip.fadeInMs ?? 0} min={0} max={3000} step={50} format={(v) => `${(v / 1000).toFixed(1)} s`} onLive={(v) => live({ fadeInMs: v })} />
          <Slider session={session} label={t('Saída suave')} value={clip.fadeOutMs ?? 0} min={0} max={3000} step={50} format={(v) => `${(v / 1000).toFixed(1)} s`} onLive={(v) => live({ fadeOutMs: v })} />
        </>
      )}

      {tool === 'color' && (
        <>
          <Slider
            session={session}
            label={t('Brilho')}
            value={clip.colorCorrection ?? 0}
            min={-100}
            max={100}
            onLive={(v) => live({ colorCorrection: v })}
          />
          <Chips options={['Zerar']} value="" label={(v) => t(v)} onPick={() => commit({ colorCorrection: 0 })} />
        </>
      )}

      {tool === 'position' && (
        <PositionTool session={session} clip={clip} live={live} commit={commit} />
      )}

      {tool === 'sphere' && <SphereTool session={session} clip={clip} commit={commit} live={live} />}

      {tool === 'text' && clip.text && (
        <TextTool session={session} text={clip.text} />
      )}
    </section>
  );
}

/** RF-021: a 360 video's view, either the whole sphere turned or a flat cut of one angle. */
function SphereTool({
  session,
  clip,
  commit,
  live,
}: {
  session: EditorSession;
  clip: Clip;
  commit: (p: Partial<Clip>) => void;
  live: (p: Partial<Clip>) => void;
}) {
  const degrees = (v: number) => `${Math.round(v)}°`;
  return (
    <>
      <Chips
        options={['Normal', 'Vídeo 360', 'Recorte plano']}
        value={!clip.spherical ? 'Normal' : clip.sphericalFlat ? 'Recorte plano' : 'Vídeo 360'}
        label={(v) => t(v)}
        onPick={(v) => commit({ spherical: v !== 'Normal', sphericalFlat: v === 'Recorte plano' })}
      />
      {clip.spherical && (
        <>
          <Slider session={session} label={t('Horizontal')} value={clip.sphericalYaw ?? 0} min={-180} max={180} format={degrees} onLive={(v) => live({ sphericalYaw: v })} />
          <Slider session={session} label={t('Vertical')} value={clip.sphericalPitch ?? 0} min={-90} max={90} format={degrees} onLive={(v) => live({ sphericalPitch: v })} />
          <Slider session={session} label={t('Inclinação')} value={clip.sphericalRoll ?? 0} min={-180} max={180} format={degrees} onLive={(v) => live({ sphericalRoll: v })} />
          {clip.sphericalFlat && (
            <Slider session={session} label={t('Campo de visão')} value={clip.sphericalFov ?? 90} min={30} max={120} format={degrees} onLive={(v) => live({ sphericalFov: v })} />
          )}
        </>
      )}
      <p className="muted">{t('Girar mantém a imagem 360 no arquivo final, mas o arquivo não leva a marcação que avisa os players de que é 360.')}</p>
    </>
  );
}

/** RF-049: ramps the speed to a target over the start or end of the clip, as one undo step. */
function SpeedRamp({ session, track, clip }: { session: EditorSession; track: Track; clip: Clip }) {
  const [target, setTarget] = useState(0.25);
  const [secs, setSecs] = useState(2);
  const [edge, setEdge] = useState<(typeof RAMP_EDGES)[number]>('end');
  const tracks = useStore(session.editor.store, (s) => s.tracks);
  // The domain leaves a ramp out when its pieces would be shorter than the minimum clip.
  const fits = applySpeedRamp(tracks, track.id, clip.id, target, secs * 1000, edge) !== tracks;
  const apply = () =>
    session.editor.commitOnSelected((t, trackId, c) =>
      applySpeedRamp(t, trackId, c.id, target, secs * 1000, edge)
    );
  return (
    <>
      <div className="field">
        <label>
          <span>{t('Rampa até')}</span>
        </label>
      </div>
      <Chips options={SPEEDS} value={target} label={(v) => `${v}x`} onPick={setTarget} />
      <Slider
        session={session}
        label={t('Duração da rampa')}
        value={secs}
        min={0.5}
        max={3}
        step={0.5}
        format={(v) => `${v.toFixed(1)} s`}
        onLive={setSecs}
      />
      <Chips
        options={RAMP_EDGES}
        value={edge}
        label={(e) => (e === 'start' ? t('No início') : t('No fim'))}
        onPick={setEdge}
      />
      {!fits && (
        <p className="muted">{t('Rampa curta demais para esta velocidade: use mais segundos.')}</p>
      )}
      <button className="primary-btn" style={{ width: '100%' }} disabled={!fits} onClick={apply}>
        {t('Aplicar rampa')}
      </button>
    </>
  );
}

/** What a clip does to the layers below it: its opacity and, if it has its own, its blend. */
function LayerLook({ session, clip }: { session: EditorSession; clip: Clip }) {
  const { editor } = session;
  return (
    <>
      <Slider session={session} label={t('Opacidade')} value={clip.opacity ?? 100} min={0} max={100} format={(v) => `${Math.round(v)}%`} onLive={(v) => editor.liveClip((c) => ({ ...c, opacity: v }))} />
      <div className="field">
        <label>{t('Mesclagem')}</label>
        <Chips
          options={['', ...TRACK_BLENDS.map((b) => b.id)]}
          value={clip.blend ?? ''}
          label={(id) => t(TRACK_BLENDS.find((b) => b.id === id)?.name ?? 'Da faixa')}
          onPick={(id) => editor.commitClip((c) => ({ ...c, blend: TRACK_BLENDS.find((b) => b.id === id)?.id }))}
        />
      </div>
    </>
  );
}

function PositionTool({
  session,
  clip,
  live,
  commit,
}: {
  session: EditorSession;
  clip: Clip;
  live: (p: Partial<Clip>) => void;
  commit: (p: Partial<Clip>) => void;
}) {
  const pos = clip.pipPosition ?? { x: 0, y: 0 };
  const size = clip.pipSize ?? { width: 1, height: 1 };
  const full = !clip.pipSize;
  // The window's height follows the picture's shape (see drawMedia); only its width is set.
  const setBox = (x: number, y: number, s: number) =>
    live({
      pipPosition: { x: Math.max(-s, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) },
      pipSize: { width: s, height: s },
    });
  return (
    <>
      <LayerLook session={session} clip={clip} />
      <Slider session={session} label={t('Rotação')} value={clip.rotation ?? 0} min={0} max={360} format={(v) => `${Math.round(v)}°`} onLive={(v) => live({ rotation: v })} />
      <Chips
        options={['Encaixar', 'Preencher']}
        value={clip.fill ? 'Preencher' : 'Encaixar'}
        label={(v) => t(v)}
        onPick={(v) => commit({ fill: v === 'Preencher' })}
      />
      <Chips
        options={['Tela cheia', 'Janela']}
        value={full ? 'Tela cheia' : 'Janela'}
        label={(v) => t(v)}
        onPick={(v) =>
          v === 'Tela cheia'
            ? commit({ pipPosition: undefined, pipSize: undefined })
            : commit({ pipPosition: { x: 0.6, y: 0.05 }, pipSize: { width: 0.35, height: 0.35 } })
        }
      />
      {!full && (
        <>
          <Slider session={session} label={t('Tamanho')} value={size.width * 100} min={10} max={100} format={(v) => `${Math.round(v)}%`} onLive={(v) => setBox(pos.x, pos.y, v / 100)} />
          <Slider session={session} label={t('Horizontal')} value={pos.x * 100} min={0} max={100} format={(v) => `${Math.round(v)}%`} onLive={(v) => setBox(v / 100, pos.y, size.width)} />
          <Slider session={session} label={t('Vertical')} value={pos.y * 100} min={0} max={100} format={(v) => `${Math.round(v)}%`} onLive={(v) => setBox(pos.x, v / 100, size.width)} />
          <Slider
            session={session}
            label={t('Borda')}
            value={clip.pipBorder?.width ?? 0}
            min={0}
            max={5}
            step={0.25}
            format={(v) => `${v.toFixed(2)}%`}
            onLive={(v) => live({ pipBorder: { color: clip.pipBorder?.color ?? '#ffffff', width: v } })}
          />
          <Chips
            options={TEXT_COLORS}
            value={clip.pipBorder?.color ?? '#ffffff'}
            label={(c) => <span style={{ display: 'inline-block', width: 16, height: 16, background: c, border: '1px solid #555' }} />}
            onPick={(color) => commit({ pipBorder: { color, width: clip.pipBorder?.width || 1 } })}
          />
        </>
      )}
    </>
  );
}

function TextTool({ session, text }: { session: EditorSession; text: ClipText }) {
  const { editor } = session;
  const clip = useStore(editor.store, (s) => selectedClipOf(s)?.clip);
  const live = (patch: Partial<ClipText>) =>
    editor.liveClip((c) => ({ ...c, text: { ...c.text!, ...patch } }));
  const commit = (patch: Partial<ClipText>) =>
    editor.commitClip((c) => {
      const next = { ...c.text!, ...patch };
      return { ...c, text: next, name: captionName(next.content) };
    });
  return (
    <>
      <div className="field">
        <label>{t('Texto')}</label>
        <textarea
          rows={3}
          value={text.content}
          onChange={(e) =>
            editor.liveClip((c) => ({
              ...c,
              text: { ...c.text!, content: e.target.value },
              name: captionName(e.target.value),
            }))
          }
          onBlur={() => editor.endGesture()}
        />
      </div>
      <Chips options={TEXT_FONTS.map((f) => f.family)} value={text.fontFamily} label={(f) => t(TEXT_FONTS.find((x) => x.family === f)!.label)} onPick={(f) => commit({ fontFamily: f })} />
      <Chips
        options={TEXT_COLORS}
        value={text.color}
        label={(c) => <span style={{ display: 'inline-block', width: 16, height: 16, background: c, border: '1px solid #555' }} />}
        onPick={(c) => commit({ color: c })}
      />
      <Chips
        options={['Sombra', 'Contorno']}
        value=""
        label={(o) => `${t(o)}: ${o === 'Sombra' ? (text.shadow ? t('sim') : t('não')) : text.strokeWidth > 0 ? t('sim') : t('não')}`}
        onPick={(o) =>
          o === 'Sombra'
            ? commit({ shadow: !text.shadow })
            : commit({ strokeWidth: text.strokeWidth > 0 ? 0 : TEXT_OUTLINE_WIDTH })
        }
      />
      {clip && <LayerLook session={session} clip={clip} />}
      <Chips
        options={TEXT_ALIGNS}
        value={text.align ?? 'center'}
        label={(a) => t(a === 'left' ? 'Esquerda' : a === 'right' ? 'Direita' : 'Centro')}
        onPick={(align) => commit({ align })}
      />
      <Slider session={session} label={t('Rotação')} value={text.rotation ?? 0} min={0} max={360} format={(v) => `${Math.round(v)}°`} onLive={(v) => live({ rotation: v })} />
      <Slider session={session} label={t('Tamanho')} value={text.size * 100} min={MIN_TEXT_SIZE * 100} max={MAX_TEXT_SIZE * 100} step={0.5} format={(v) => `${v.toFixed(1)}%`} onLive={(v) => live({ size: v / 100 })} />
      <Slider session={session} label={t('Horizontal')} value={text.x * 100} min={0} max={100} format={(v) => `${Math.round(v)}%`} onLive={(v) => live({ x: v / 100 })} />
      <Slider session={session} label={t('Vertical')} value={text.y * 100} min={0} max={100} format={(v) => `${Math.round(v)}%`} onLive={(v) => live({ y: v / 100 })} />
      <div className="field">
        <label>{t('Animação de entrada')}</label>
        <Chips options={TEXT_ANIMATIONS.map((a) => a.id)} value={text.animIn.type} label={(id) => t(TEXT_ANIMATIONS.find((a) => a.id === id)!.label)} onPick={(type) => commit({ animIn: { ...text.animIn, type } })} />
      </div>
      <div className="field">
        <label>{t('Animação de saída')}</label>
        <Chips options={TEXT_ANIMATIONS.map((a) => a.id)} value={text.animOut.type} label={(id) => t(TEXT_ANIMATIONS.find((a) => a.id === id)!.label)} onPick={(type) => commit({ animOut: { ...text.animOut, type } })} />
      </div>
    </>
  );
}
