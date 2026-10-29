import { t } from '../../i18n';
import { useRef, useState } from 'react';
import type { PhotoSession } from '../../application/session';
import { ADJUST_DRAWER_FIELDS } from '../../domain/adjustments';
import { SELECTIVE_COLOR_NAMES, SELECTIVE_HUES_DEG } from '../../domain/color/colorAdjustments';
import { useStore } from '../../state/useStore';
import { Chips, commit, FieldSlider } from '../controls';

const TABS = ['Básico', 'Curvas', 'Detalhe', 'Cor seletiva'] as const;
type Tab = (typeof TABS)[number];
const CHANNELS = ['RGB', 'R', 'G', 'B'] as const;
type Channel = (typeof CHANNELS)[number];
const CHANNEL_COLOR: Record<Channel, string> = {
  RGB: 'var(--acento)',
  R: 'rgb(210,82,82)',
  G: 'rgb(95,185,143)',
  B: 'rgb(58,143,222)',
};

/** Ajustes (US-04): colour and tone, with the photo's histogram. */
export function AdjustPanel({ session }: { session: PhotoSession }) {
  const [tab, setTab] = useState<Tab>('Básico');
  const s = (field: string, label: string, min: number, max: number, step = 1) => (
    <FieldSlider session={session} field={field} label={label} min={min} max={max} step={step} />
  );
  return (
    <>
      <div className="panel-row">
        <Chips options={TABS} value={tab} onPick={setTab} />
        <button
          className="chip"
          title={t('Aplica os ajustes na foto e começa do zero')}
          onClick={() => void session.bake(ADJUST_DRAWER_FIELDS)}
        >
          ✓ {t('Aplicar')}
        </button>
      </div>
      {tab === 'Básico' && (
        <>
          <Histogram session={session} />
          {s('temperatura', t('Temperatura'), -100, 100)}
          {s('tint', t('Matiz de branco'), -100, 100)}
          {s('matiz', t('Matiz'), -100, 100)}
          {s('saturacao', t('Saturação'), -100, 100)}
          {s('luminosidade', t('Luminosidade'), -100, 100)}
          {s('vibracao', t('Vibração'), -100, 100)}
          <FieldSlider
            session={session}
            field="exposicao"
            label={t('Exposição')}
            min={-3}
            max={3}
            step={0.05}
            format={(v) => v.toFixed(2)}
          />
        </>
      )}
      {tab === 'Curvas' && <Curves session={session} />}
      {tab === 'Detalhe' && (
        <>
          {s('nitidez', t('Nitidez'), 0, 100)}
          <FieldSlider session={session} field="raio" label={t('Raio')} min={0} max={5} step={0.1} format={(v) => v.toFixed(1)} />
          {s('reducaoRuido', t('Redução ruído'), 0, 100)}
          {s('luminancia', t('Luminância'), 0, 100)}
        </>
      )}
      {tab === 'Cor seletiva' && <Selective session={session} />}
    </>
  );
}

function Histogram({ session }: { session: PhotoSession }) {
  const h = useStore(session.histogram);
  if (!h) return <div className="histogram" />;
  const path = (bins: number[]) =>
    `M0,40 ${bins.map((v, i) => `L${(i / (bins.length - 1)) * 100},${40 - v * 40}`).join(' ')} L100,40 Z`;
  return (
    <svg className="histogram" viewBox="0 0 100 40" preserveAspectRatio="none">
      <path d={path(h.r)} fill="rgba(210,82,82,0.45)" />
      <path d={path(h.g)} fill="rgba(95,185,143,0.45)" />
      <path d={path(h.b)} fill="rgba(58,143,222,0.45)" />
    </svg>
  );
}

/** RF-029: a curve through (0,0)-(1/3,y1)-(2/3,y2)-(1,1) per channel; drag its two points. */
function Curves({ session }: { session: PhotoSession }) {
  const [channel, setChannel] = useState<Channel>('RGB');
  const prefix = channel === 'RGB' ? 'Master' : channel;
  const f1 = `curve${prefix}Y1`;
  const f2 = `curve${prefix}Y2`;
  const { editor } = session;
  const y1 = useStore(editor.store, (st) => st.adjustments[f1]);
  const y2 = useStore(editor.store, (st) => st.adjustments[f2]);
  const drag = useRef<{ field: string; from: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const toY = (clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, 1 - (clientY - r.top) / r.height));
  };
  const point = (field: string, x: number, y: number) => (
    <circle
      cx={x * 100}
      cy={(1 - y) * 100}
      r={5}
      fill={CHANNEL_COLOR[channel]}
      style={{ touchAction: 'none', cursor: 'ns-resize' }}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        drag.current = { field, from: editor.store.get().adjustments[field] };
      }}
      onPointerMove={(e) => drag.current?.field === field && editor.setField(field, toY(e.clientY))}
      onPointerUp={() => {
        const d = drag.current;
        if (d) editor.commitField(d.field, editor.store.get().adjustments[d.field], d.from);
        drag.current = null;
      }}
    />
  );
  return (
    <>
      <svg ref={svgRef} className="curve" viewBox="-6 -6 112 112">
        <path d="M33.3,0V100M66.6,0V100M0,33.3H100M0,66.6H100M0,100L100,0" stroke="var(--linha)" fill="none" />
        <path
          d={`M0,100 L33.3,${(1 - y1) * 100} L66.6,${(1 - y2) * 100} L100,0`}
          stroke={CHANNEL_COLOR[channel]}
          strokeWidth={2}
          fill="none"
        />
        {point(f1, 1 / 3, y1)}
        {point(f2, 2 / 3, y2)}
      </svg>
      <Chips options={CHANNELS} value={channel} onPick={setChannel} />
    </>
  );
}

/** RF-059: keep one colour band, pull the rest towards grey, and shift the band itself. */
function Selective({ session }: { session: PhotoSession }) {
  const index = useStore(session.editor.store, (st) => st.adjustments.corIndex);
  return (
    <>
      <div className="chips">
        {SELECTIVE_COLOR_NAMES.map((name, i) => (
          <button
            key={name}
            className={`chip swatch${index === i ? ' on' : ''}`}
            style={{ ['--swatch' as string]: `hsl(${SELECTIVE_HUES_DEG[i]} 80% 55%)` }}
            onClick={() => commit(session, 'corIndex', index === i ? -1 : i)}
          >
            {t(name)}
          </button>
        ))}
      </div>
      {index >= 0 && (
        <>
          <FieldSlider session={session} field="corTolerancia" label={t('Tolerância')} min={0} max={100} />
          <FieldSlider session={session} field="corDesaturarResto" label={t('Dessat. resto')} min={0} max={100} />
          <FieldSlider session={session} field="corMatiz" label={t('Matiz')} min={-100} max={100} />
          <FieldSlider session={session} field="corSaturacao" label={t('Saturação')} min={-100} max={100} />
          <FieldSlider session={session} field="corLuminosidade" label={t('Luminosidade')} min={-100} max={100} />
        </>
      )}
    </>
  );
}
