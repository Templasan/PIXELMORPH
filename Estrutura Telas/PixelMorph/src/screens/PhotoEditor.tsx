import { useState, useRef, useCallback } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
  onOpenDrawer: () => void;
  onExport: () => void;
}

type Tool = 'ajustes' | 'geometria' | 'mascaras' | 'retoque' | 'camadas' | 'efeitos' | 'elementos' | 'ia' | 'presets' | null;

const TOOLBAR = [
  { id: 'ajustes', icon: 'sliders', label: 'Ajustes' },
  { id: 'geometria', icon: 'crop', label: 'Geometria' },
  { id: 'mascaras', icon: 'mask', label: 'Máscaras' },
  { id: 'retoque', icon: 'retouch', label: 'Retoque' },
  { id: 'camadas', icon: 'layers', label: 'Camadas' },
  { id: 'efeitos', icon: 'effects', label: 'Efeitos' },
  { id: 'elementos', icon: 'type', label: 'Elementos' },
  { id: 'ia', icon: 'robot', label: 'IA' },
  { id: 'presets', icon: 'preset', label: 'Presets' },
] as const;

const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

function Slider({
  label,
  value,
  onChange,
  min = -100,
  max = 100,
  bipolar = true,
  gradient = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  bipolar?: boolean;
  gradient?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
      <span style={{ fontSize: 12, color: '#8E8E8E', width: 88, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 20, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 2,
            background: gradient
              ? 'linear-gradient(to right, #4477FF, #FF8833)'
              : '#3C3C3C',
          }}
        />
        {bipolar && !gradient && (
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1, height: 8, background: '#555', transform: 'translateY(-50%)' }} />
        )}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
        />
        <div
          style={{
            position: 'absolute',
            width: 12,
            height: 12,
            background: '#E4E4E4',
            left: `calc(${pct}% - 6px)`,
            pointerEvents: 'none',
          }}
        />
      </div>
      <span style={{ ...M, fontSize: 12, color: '#E4E4E4', width: 32, textAlign: 'right' }}>
        {value > 0 && !gradient ? `+${value}` : value}
      </span>
    </div>
  );
}

function DrawerTabs({ tabs, active, onSelect }: { tabs: string[]; active: string; onSelect: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C', overflowX: 'auto' }}>
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onSelect(t)}
          style={{
            padding: '8px 12px',
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            color: active === t ? '#3A8FDE' : '#8E8E8E',
            background: 'none',
            border: 'none',
            borderBottom: active === t ? '2px solid #3A8FDE' : '2px solid transparent',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function AdjustDrawer({
  temperatura, setTemperatura, matiz, setMatiz,
  saturacao, setSaturacao, luminosidade, setLuminosidade,
  vibracao, setVibracao, exposicao, setExposicao,
}: {
  temperatura: number; setTemperatura: (v: number) => void;
  matiz: number; setMatiz: (v: number) => void;
  saturacao: number; setSaturacao: (v: number) => void;
  luminosidade: number; setLuminosidade: (v: number) => void;
  vibracao: number; setVibracao: (v: number) => void;
  exposicao: number; setExposicao: (v: number) => void;
}) {
  const [tab, setTab] = useState('Básico');
  const [curveChannel, setCurveChannel] = useState('RGB');

  return (
    <div>
      <DrawerTabs tabs={['Básico', 'Curvas', 'Detalhe', 'Cor seletiva']} active={tab} onSelect={setTab} />
      {tab === 'Básico' && (
        <div>
          {/* Histograma — curvas RGB */}
          <div style={{ margin: '8px 12px', height: 56, background: '#1F1F1F', border: '1px solid #3C3C3C', position: 'relative', overflow: 'hidden' }}>
            <svg style={{ position: 'absolute', inset: 0 }} width="100%" height="56" viewBox="0 0 256 56" preserveAspectRatio="none">
              <path d="M0,56 C30,55 50,44 80,18 C100,3 116,8 132,15 C152,23 182,40 222,51 C242,54 252,56 256,56 Z" fill="rgba(210,82,82,0.4)" />
              <path d="M0,56 C30,55 50,44 80,18 C100,3 116,8 132,15 C152,23 182,40 222,51 C242,54 252,56 256,56" fill="none" stroke="rgba(210,82,82,0.75)" strokeWidth="1" />
              <path d="M0,56 C20,56 40,50 70,26 C95,8 116,13 142,19 C167,27 186,41 216,51 C236,54 248,56 256,56 Z" fill="rgba(95,185,143,0.4)" />
              <path d="M0,56 C20,56 40,50 70,26 C95,8 116,13 142,19 C167,27 186,41 216,51 C236,54 248,56 256,56" fill="none" stroke="rgba(95,185,143,0.75)" strokeWidth="1" />
              <path d="M0,56 C14,55 28,47 54,20 C74,2 95,7 116,13 C142,21 172,38 212,51 C233,54 246,56 256,56 Z" fill="rgba(58,143,222,0.4)" />
              <path d="M0,56 C14,55 28,47 54,20 C74,2 95,7 116,13 C142,21 172,38 212,51 C233,54 246,56 256,56" fill="none" stroke="rgba(58,143,222,0.75)" strokeWidth="1" />
            </svg>
          </div>
          <Slider label="Temperatura" value={temperatura} onChange={setTemperatura} gradient />
          <Slider label="Matiz" value={matiz} onChange={setMatiz} />
          <Slider label="Saturação" value={saturacao} onChange={setSaturacao} />
          <Slider label="Luminosidade" value={luminosidade} onChange={setLuminosidade} />
          <Slider label="Vibração" value={vibracao} onChange={setVibracao} />
          <Slider label="Exposição" value={exposicao} onChange={setExposicao} min={-3} max={3} />
        </div>
      )}
      {tab === 'Curvas' && (
        <div style={{ padding: 12 }}>
          <div style={{ position: 'relative', height: 160, background: '#1F1F1F', border: '1px solid #3C3C3C', overflow: 'hidden' }}>
            {/* Histograma translúcido de fundo */}
            <svg style={{ position: 'absolute', inset: 0 }} width="100%" height="160" viewBox="0 0 256 160" preserveAspectRatio="none">
              <path d="M0,160 C30,158 50,126 80,52 C100,8 116,22 132,42 C152,66 182,114 222,146 C242,154 252,158 256,160 Z" fill="rgba(210,82,82,0.18)" />
              <path d="M0,160 C20,160 40,143 70,74 C95,22 116,38 142,54 C167,78 186,118 216,146 C236,154 248,160 256,160 Z" fill="rgba(95,185,143,0.18)" />
              <path d="M0,160 C14,158 28,134 54,58 C74,6 95,20 116,38 C142,60 172,109 212,146 C233,154 246,160 256,160 Z" fill="rgba(58,143,222,0.18)" />
            </svg>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.2 }}>
              <line x1="33%" y1="0" x2="33%" y2="100%" stroke="#E4E4E4" strokeWidth="1" />
              <line x1="66%" y1="0" x2="66%" y2="100%" stroke="#E4E4E4" strokeWidth="1" />
              <line x1="0" y1="33%" x2="100%" y2="33%" stroke="#E4E4E4" strokeWidth="1" />
              <line x1="0" y1="66%" x2="100%" y2="66%" stroke="#E4E4E4" strokeWidth="1" />
              <line x1="0" y1="100%" x2="100%" y2="0" stroke="#E4E4E4" strokeWidth="1" />
            </svg>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <path d="M0,160 C40,155 55,120 80,80 C105,40 120,8 160,0" fill="none" stroke="#3A8FDE" strokeWidth="2" />
              <circle cx="80" cy="80" r="5" fill="#3A8FDE" style={{ cursor: 'move' }} />
              <circle cx="120" cy="38" r="5" fill="#3A8FDE" style={{ cursor: 'move' }} />
            </svg>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {['RGB', 'R', 'G', 'B'].map(c => (
              <button
                key={c}
                onClick={() => setCurveChannel(c)}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  border: `1px solid ${curveChannel === c ? '#3A8FDE' : '#3C3C3C'}`,
                  color: curveChannel === c ? '#3A8FDE' : '#8E8E8E',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === 'Detalhe' && (
        <div>
          <Slider label="Nitidez" value={25} onChange={() => {}} min={0} max={100} bipolar={false} />
          <Slider label="Raio" value={1} onChange={() => {}} min={0} max={5} bipolar={false} />
          <Slider label="Redução ruído" value={10} onChange={() => {}} min={0} max={100} bipolar={false} />
          <Slider label="Luminância" value={5} onChange={() => {}} min={0} max={100} bipolar={false} />
        </div>
      )}
      {tab === 'Cor seletiva' && (
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {['Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Ciano', 'Azul', 'Magenta'].map(c => (
              <div key={c} style={{ padding: '3px 8px', border: '1px solid #3C3C3C', fontSize: 11, color: '#8E8E8E', cursor: 'pointer' }}>{c}</div>
            ))}
          </div>
          <Slider label="Matiz" value={0} onChange={() => {}} />
          <Slider label="Saturação" value={0} onChange={() => {}} />
          <Slider label="Luminosidade" value={0} onChange={() => {}} />
        </div>
      )}
    </div>
  );
}

function GeometriaDrawer() {
  const [rotation, setRotation] = useState(0);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '12px 12px 8px', flexWrap: 'wrap' }}>
        {['90°', '180°', '270°', 'Auto EXIF'].map(r => (
          <button key={r} style={{ padding: '6px 12px', border: '1px solid #3C3C3C', fontSize: 12, color: '#E4E4E4', background: 'transparent', cursor: 'pointer' }}>{r}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 12px 8px' }}>
        <button style={{ flex: 1, padding: '6px 8px', border: '1px solid #3C3C3C', fontSize: 11, color: '#8E8E8E', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="flipHorizontal" size={14} color="#8E8E8E" />Espelhar H
        </button>
        <button style={{ flex: 1, padding: '6px 8px', border: '1px solid #3C3C3C', fontSize: 11, color: '#8E8E8E', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="flipHorizontal" size={14} color="#8E8E8E" />Espelhar V
        </button>
      </div>
      <Slider label="Rotação" value={rotation} onChange={setRotation} min={-45} max={45} />
      <Slider label="Vertical" value={0} onChange={() => {}} />
      <Slider label="Horizontal" value={0} onChange={() => {}} />
      <div style={{ margin: '8px 12px', padding: '8px 10px', background: 'rgba(210,160,94,0.12)', border: '1px solid rgba(210,160,94,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="sun" size={14} color="#D2A05E" />
        <span style={{ fontSize: 11, color: '#D2A05E' }}>Sugestão: recorte 3:2 pela regra dos terços</span>
      </div>
    </div>
  );
}

function MascarasDrawer() {
  const [tab, setTab] = useState('Pincel');
  return (
    <div>
      <DrawerTabs tabs={['Pincel', 'Cor', 'Foco', 'Gradiente']} active={tab} onSelect={setTab} />
      <Slider label="Tamanho" value={40} onChange={() => {}} min={1} max={200} bipolar={false} />
      <Slider label="Dureza" value={80} onChange={() => {}} min={0} max={100} bipolar={false} />
      <Slider label="Fluxo" value={100} onChange={() => {}} min={0} max={100} bipolar={false} />
      <Slider label="Tolerância" value={30} onChange={() => {}} min={0} max={100} bipolar={false} />
      <div style={{ padding: '4px 12px 8px' }}>
        <div style={{ fontSize: 11, color: '#8E8E8E', marginBottom: 6 }}>Ajustes dentro da máscara</div>
        <Slider label="Exposição" value={0} onChange={() => {}} />
        <Slider label="Contraste" value={0} onChange={() => {}} />
      </div>
    </div>
  );
}

function RetoqueDrawer() {
  const [tab, setTab] = useState('Clonagem');
  return (
    <div>
      <DrawerTabs tabs={['Clonagem', 'Liquify']} active={tab} onSelect={setTab} />
      <div style={{ padding: '8px 12px', fontSize: 12, color: '#8E8E8E' }}>
        {tab === 'Clonagem'
          ? 'Segure Alt para definir a origem, depois pinte o destino.'
          : 'Arraste para distorcer pixels livremente.'}
      </div>
      <Slider label="Tamanho" value={30} onChange={() => {}} min={1} max={200} bipolar={false} />
      <Slider label="Dureza" value={60} onChange={() => {}} min={0} max={100} bipolar={false} />
      <Slider label="Fluxo" value={80} onChange={() => {}} min={0} max={100} bipolar={false} />
    </div>
  );
}

function EfeitosDrawer() {
  const [tab, setTab] = useState('Retrô');
  const [intensity, setIntensity] = useState(70);
  const effects = ['Vintage 70s', 'Film Grain', 'Lomo', 'Polaroid', 'Kodachrome', 'Faded'];
  return (
    <div>
      <DrawerTabs tabs={['Retrô', 'Molduras', 'Iluminação', 'Dupla exposição', 'Overlays']} active={tab} onSelect={setTab} />
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', overflowX: 'auto' }}>
        {effects.map((ef, i) => (
          <div key={ef} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 56, height: 56, border: `1px solid ${i === 0 ? '#3A8FDE' : '#3C3C3C'}`, background: '#1F1F1F' }} />
            <span style={{ fontSize: 9, color: i === 0 ? '#3A8FDE' : '#8E8E8E', maxWidth: 56, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ef}</span>
          </div>
        ))}
      </div>
      <Slider label="Intensidade" value={intensity} onChange={setIntensity} min={0} max={100} bipolar={false} />
      <Slider label="Mesclagem" value={100} onChange={() => {}} min={0} max={100} bipolar={false} />
    </div>
  );
}

function ElementosDrawer() {
  const [tab, setTab] = useState('Texto');
  return (
    <div>
      <DrawerTabs tabs={['Texto', 'Formas', 'Adesivos', 'Meme', 'Colagem']} active={tab} onSelect={setTab} />
      {tab === 'Texto' && (
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {['Roboto', 'Montserrat', 'Playfair', 'Bebas', 'Anton'].map(f => (
              <div key={f} style={{ padding: '4px 8px', border: '1px solid #3C3C3C', fontSize: 11, color: '#E4E4E4', cursor: 'pointer' }}>{f}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {['#E4E4E4', '#3A8FDE', '#D25252', '#5FB98F', '#D2A05E'].map(c => (
              <div key={c} style={{ width: 24, height: 24, background: c, border: '1px solid #3C3C3C', cursor: 'pointer' }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#8E8E8E', marginBottom: 6 }}>Animação</div>
          <Slider label="Entrada" value={0} onChange={() => {}} min={0} max={100} bipolar={false} />
          <Slider label="Saída" value={100} onChange={() => {}} min={0} max={100} bipolar={false} />
        </div>
      )}
      {tab === 'Colagem' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{ border: '1px solid #3C3C3C', aspectRatio: '1', background: '#1F1F1F', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 4 }}
            >
              <div style={{ background: '#3C3C3C', gridRow: i % 2 === 0 ? '1/3' : '1' }} />
              <div style={{ background: '#3C3C3C' }} />
              {i % 2 !== 0 && <div style={{ background: '#3C3C3C' }} />}
            </div>
          ))}
        </div>
      )}
      {(tab === 'Formas' || tab === 'Adesivos' || tab === 'Meme') && (
        <div style={{ padding: 16, fontSize: 12, color: '#8E8E8E' }}>
          Selecione um elemento para inserir no canvas.
        </div>
      )}
    </div>
  );
}

function IADrawer() {
  const [tab, setTab] = useState('Recorte');
  const colors = ['#3A5F8A', '#C4A86B', '#7BA3C2', '#8B7355', '#E8D5B0'];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #3C3C3C', paddingRight: 12 }}>
        <DrawerTabs tabs={['Recorte', 'Retrato', 'Sugestões', 'Artístico']} active={tab} onSelect={setTab} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5FB98F' }} />
          <span style={{ fontSize: 10, color: '#5FB98F', whiteSpace: 'nowrap' }}>No dispositivo</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px' }}>
        {['Remover fundo', 'Substituir fundo', 'Remover objeto', 'Preencher área'].map(a => (
          <button
            key={a}
            style={{ padding: '10px 8px', border: '1px solid #3C3C3C', fontSize: 11, color: '#E4E4E4', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
          >
            <Icon name="zap" size={16} color="#3A8FDE" />
            {a}
          </button>
        ))}
      </div>
      <div style={{ padding: '0 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#8E8E8E' }}>Cena detectada:</span>
          <span style={{ padding: '2px 8px', background: 'rgba(58,143,222,0.15)', border: '1px solid rgba(58,143,222,0.4)', fontSize: 11, color: '#3A8FDE' }}>Praia ao pôr do sol</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {colors.map(c => (
            <div key={c} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: 20, background: c }} />
              <span style={{ ...M, fontSize: 9, color: '#8E8E8E' }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PresetsDrawer() {
  const presets = ['Minha edição 1', 'Praia dourada', 'Retrô frio', 'Sépia suave', 'Preto & Branco'];
  return (
    <div style={{ padding: 12 }}>
      {presets.map(p => (
        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #3C3C3C' }}>
          <div style={{ width: 40, height: 40, background: '#1F1F1F', border: '1px solid #3C3C3C', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: '#E4E4E4' }}>{p}</span>
          <Icon name="chevronRight" size={16} color="#8E8E8E" />
        </div>
      ))}
      <button style={{ width: '100%', marginTop: 12, padding: '8px 0', border: '1px solid #3A8FDE', fontSize: 12, color: '#3A8FDE', background: 'transparent', cursor: 'pointer' }}>
        + Salvar ajustes atuais
      </button>
    </div>
  );
}

export default function PhotoEditorScreen({ navigate, onOpenDrawer, onExport }: Props) {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSplit, setCompareSplit] = useState(50);
  const [zoom, setZoom] = useState(100);
  const [layersVisible, setLayersVisible] = useState<Record<string, boolean>>({
    texto: true, pintura: true, efeitos: true, vinheta: true, granulado: true, mascara: true, ajustes: true, fundo: true,
  });
  const [groupExpanded, setGroupExpanded] = useState(true);
  const [temperatura, setTemperatura] = useState(0);
  const [matiz, setMatiz] = useState(0);
  const [saturacao, setSaturacao] = useState(0);
  const [luminosidade, setLuminosidade] = useState(0);
  const [vibracao, setVibracao] = useState(0);
  const [exposicao, setExposicao] = useState(0);

  const compareRef = useRef<HTMLDivElement>(null);

  const handleCompareMove = useCallback((clientX: number) => {
    const el = compareRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCompareSplit(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const toggleTool = (tool: Tool) => setActiveTool(prev => prev === tool ? null : tool);

  const layerDefs = [
    { key: 'texto', name: 'Texto', type: 'Texto', img: 'photo-1611532736597-de2d4265fba3', locked: false },
    { key: 'pintura', name: 'Pintura à mão', type: 'Normal', img: 'photo-1558618666-fcd25c85cd64', locked: false },
    { key: 'efeitos', name: 'Efeitos', type: 'Grupo', img: 'photo-1504701954957-2010ec3bcec1', locked: false, group: true },
    { key: 'vinheta', name: 'Vinheta', type: 'Efeito', img: 'photo-1507525428034-b723cf961d3e', locked: false, child: true },
    { key: 'granulado', name: 'Granulado', type: 'Efeito', img: 'photo-1469474968028-56623f02e42e', locked: false, child: true },
    { key: 'mascara', name: 'Máscara céu', type: 'Máscara', img: 'photo-1507525428034-b723cf961d3e', locked: false },
    { key: 'ajustes', name: 'Ajustes de cor', type: 'Ajuste', img: 'photo-1531746020798-e6953c6e8e04', locked: false },
    { key: 'fundo', name: 'Fundo', type: 'Normal', img: 'photo-1507525428034-b723cf961d3e', locked: true },
  ];

  const imgFilter = [
    saturacao !== 0 ? `saturate(${1 + saturacao / 100})` : '',
    (exposicao !== 0 || luminosidade !== 0) ? `brightness(${Math.max(0.1, 1 + exposicao / 100 + luminosidade / 200)})` : '',
    matiz !== 0 ? `hue-rotate(${matiz * 1.8}deg)` : '',
    temperatura !== 0 ? `sepia(${Math.abs(temperatura) / 300}) hue-rotate(${temperatura > 0 ? 12 : -12}deg)` : '',
  ].filter(Boolean).join(' ') || 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1A1A1A', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 48, background: '#252525', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, borderBottom: '1px solid #3C3C3C', boxShadow: '0 1px 4px rgba(0,0,0,0.5)', flexShrink: 0 }}>
        <button onClick={() => navigate('projects')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Icon name="chevronLeft" size={20} color="#B0B0B0" />
        </button>
        <span style={{ flex: 1, fontSize: 13, color: '#E4E4E4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Ensaio Praia 04<span style={{ color: '#D25252' }}>●</span>
        </span>
        <button onClick={() => setCompareMode(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <Icon name="compare" size={18} color={compareMode ? '#3A8FDE' : '#B0B0B0'} />
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Icon name="undo" size={18} color="#B0B0B0" /></button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Icon name="redo" size={18} color="#B0B0B0" /></button>
        <button
          onClick={onExport}
          style={{ padding: '4px 10px', background: '#3A8FDE', color: '#0D0D0D', fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}
        >
          Exportar
        </button>
      </div>

      {/* Tech strip */}
      <div style={{ height: 28, background: '#1F1F1F', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '1px solid #3C3C3C', flexShrink: 0 }}>
        <span style={{ ...M, fontSize: 11, color: '#8E8E8E' }}>6000 × 4000 · Adobe RGB · 14 bits</span>
        <span style={{ ...M, fontSize: 11, color: '#8E8E8E' }}>RAM 412 MB</span>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ position: 'relative' }}>
          <img
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=340&h=227&fit=crop&auto=format"
            alt="Photo"
            style={{ display: 'block', maxWidth: '100%', filter: imgFilter }}
          />

          {compareMode && (
            <div
              ref={compareRef}
              style={{ position: 'absolute', inset: 0 }}
              onMouseMove={e => { if (e.buttons === 1) handleCompareMove(e.clientX); }}
              onTouchMove={e => handleCompareMove(e.touches[0].clientX)}
            >
              <div
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${compareSplit}%`, overflow: 'hidden' }}
              >
                <img
                  src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=340&h=227&fit=crop&auto=format"
                  alt="Original"
                  style={{ position: 'absolute', top: 0, left: 0, width: 340, height: 227, objectFit: 'cover' }}
                />
              </div>
              <div
                style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: '#fff', cursor: 'ew-resize', left: `calc(${compareSplit}% - 1px)` }}
                onMouseDown={() => {
                  const move = (ev: MouseEvent) => handleCompareMove(ev.clientX);
                  document.addEventListener('mousemove', move);
                  document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), { once: true });
                }}
              >
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 24, height: 24, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="compare" size={14} color="#000" />
                </div>
              </div>
              <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '1px 4px' }}>ORIGINAL</div>
              <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '1px 4px' }}>EDITADA</div>
            </div>
          )}
        </div>

        {/* Layers panel */}
        {activeTool === 'camadas' && (
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 220, background: '#252525', borderLeft: '1px solid #3C3C3C', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
            {/* Título */}
            <div style={{ height: 30, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: '1px solid #3C3C3C' }}>
              <span style={{ fontSize: 11, color: '#8E8E8E', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>Camadas</span>
            </div>
            {/* Barra de ações */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '3px 6px', gap: 2, borderBottom: '1px solid #3C3C3C', background: '#1F1F1F' }}>
              {[
                { title: 'Adicionar', symbol: '+', danger: false },
                { title: 'Duplicar', symbol: '⧉', danger: false },
                { title: 'Mesclar visíveis', symbol: '⊕', danger: false },
                { title: 'Agrupar', symbol: '▣', danger: false },
                { title: 'Excluir', symbol: '✕', danger: true },
              ].map(({ title, symbol, danger }) => (
                <button
                  key={title}
                  title={title}
                  style={{
                    flex: 1, background: 'none', border: 'none',
                    color: danger ? '#D25252' : '#B0B0B0',
                    fontSize: 13, cursor: 'pointer', padding: '3px 0',
                    lineHeight: 1,
                  }}
                >{symbol}</button>
              ))}
            </div>
            {/* Lista de camadas */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {layerDefs.map(layer => {
                if (layer.child && !groupExpanded) return null;
                const vis = layersVisible[layer.key] ?? true;
                return (
                  <div key={layer.key}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: layer.child ? '6px 10px 6px 22px' : '6px 10px',
                        borderBottom: '1px solid #3C3C3C',
                        opacity: vis ? 1 : 0.4,
                        position: 'relative',
                      }}
                    >
                      {/* Linha de conexão para filhos */}
                      {layer.child && (
                        <div style={{
                          position: 'absolute', left: 14, top: 0, bottom: 0,
                          width: 1, background: '#3C3C3C',
                        }} />
                      )}
                      <button
                        onClick={() => setLayersVisible(prev => ({ ...prev, [layer.key]: !prev[layer.key] }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                      >
                        <Icon name={vis ? 'eye' : 'eyeOff'} size={13} color={vis ? '#B0B0B0' : '#444'} />
                      </button>
                      {layer.group && (
                        <button
                          onClick={() => setGroupExpanded(e => !e)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, fontSize: 8, color: '#8E8E8E' }}
                        >{groupExpanded ? '▾' : '▸'}</button>
                      )}
                      <div style={{ width: 26, height: 26, flexShrink: 0, overflow: 'hidden', border: '1px solid #3C3C3C' }}>
                        <img
                          src={`https://images.unsplash.com/${layer.img}?w=26&h=26&fit=crop&auto=format`}
                          alt={layer.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: vis ? 1 : 0.3 }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: vis ? '#E4E4E4' : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layer.name}</div>
                        <div style={{ fontSize: 9, color: '#8E8E8E' }}>{layer.type}</div>
                      </div>
                      {layer.locked && <Icon name="lock" size={11} color="#8E8E8E" />}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Rodapé */}
            <div style={{ borderTop: '1px solid #3C3C3C', padding: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#8E8E8E', width: 56, flexShrink: 0 }}>Opacidade</span>
                <input type="range" min={0} max={100} defaultValue={100} style={{ flex: 1, accentColor: '#3A8FDE' }} />
                <span style={{ ...M, fontSize: 11, color: '#E4E4E4', width: 24, textAlign: 'right' }}>100</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#8E8E8E', width: 56, flexShrink: 0 }}>Modo</span>
                <div style={{ flex: 1, fontSize: 11, color: '#E4E4E4', background: '#2F2F2F', border: '1px solid #3C3C3C', padding: '2px 6px' }}>Normal</div>
              </div>
            </div>
          </div>
        )}

        {/* Zoom bar */}
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(37,37,37,0.92)', padding: '4px 12px', border: '1px solid #3C3C3C' }}>
          <button onClick={() => setZoom(z => Math.max(25, z - 25))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icon name="minus" size={14} color="#B0B0B0" />
          </button>
          <span style={{ ...M, fontSize: 11, color: '#E4E4E4', width: 36, textAlign: 'center' }}>{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(400, z + 25))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icon name="plus" size={14} color="#B0B0B0" />
          </button>
        </div>
      </div>

      {/* Tool drawer */}
      {activeTool && activeTool !== 'camadas' && (
        <div style={{ height: '45%', background: '#252525', borderTop: '1px solid #3C3C3C', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <div style={{ width: 32, height: 3, background: '#3C3C3C' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTool === 'ajustes' && (
              <AdjustDrawer
                temperatura={temperatura} setTemperatura={setTemperatura}
                matiz={matiz} setMatiz={setMatiz}
                saturacao={saturacao} setSaturacao={setSaturacao}
                luminosidade={luminosidade} setLuminosidade={setLuminosidade}
                vibracao={vibracao} setVibracao={setVibracao}
                exposicao={exposicao} setExposicao={setExposicao}
              />
            )}
            {activeTool === 'geometria' && <GeometriaDrawer />}
            {activeTool === 'mascaras' && <MascarasDrawer />}
            {activeTool === 'retoque' && <RetoqueDrawer />}
            {activeTool === 'efeitos' && <EfeitosDrawer />}
            {activeTool === 'elementos' && <ElementosDrawer />}
            {activeTool === 'ia' && <IADrawer />}
            {activeTool === 'presets' && <PresetsDrawer />}
          </div>
        </div>
      )}

      {/* Bottom toolbar */}
      <div style={{ background: '#252525', borderTop: '1px solid #3C3C3C', flexShrink: 0 }}>
        <div style={{ display: 'flex', overflowX: 'auto' }}>
          {TOOLBAR.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => toggleTool(id as Tool)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '8px 12px',
                flexShrink: 0,
                background: activeTool === id ? '#1A1A1A' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Icon name={icon} size={22} color={activeTool === id ? '#3A8FDE' : '#B0B0B0'} />
              <span style={{ fontSize: 10, color: activeTool === id ? '#3A8FDE' : '#8E8E8E' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
