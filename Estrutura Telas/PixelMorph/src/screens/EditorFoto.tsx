import { useState, useRef } from 'react';
import {
  ChevronLeft,
  Undo2,
  Redo2,
  Columns2,
  SlidersHorizontal,
  Crop,
  Circle,
  Eraser,
  Layers,
  Sparkles,
  Wand2,
  Type,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import Slider from '../components/Slider';

interface Props {
  onVoltar: () => void;
  onExportar: () => void;
  projeto: string | null;
}

type Ferramenta =
  | 'ajustes'
  | 'geometria'
  | 'mascaras'
  | 'retoque'
  | 'camadas'
  | 'efeitos'
  | 'elementos'
  | 'ia'
  | 'presets'
  | null;
type AbaAjuste = 'Básico' | 'Curvas' | 'Detalhe' | 'Cor seletiva';
type AbaIa = 'Recorte' | 'Retrato' | 'Sugestões' | 'Artístico';
type AbaEfeito = 'Retrô' | 'Molduras' | 'Iluminação' | 'Dupla exposição' | 'Overlays';

const ferramentas = [
  { id: 'ajustes', label: 'Ajustes', Icon: SlidersHorizontal },
  { id: 'geometria', label: 'Geometria', Icon: Crop },
  { id: 'mascaras', label: 'Máscaras', Icon: Circle },
  { id: 'retoque', label: 'Retoque', Icon: Eraser },
  { id: 'camadas', label: 'Camadas', Icon: Layers },
  { id: 'efeitos', label: 'Efeitos', Icon: Sparkles },
  { id: 'elementos', label: 'Elementos', Icon: Type },
  { id: 'ia', label: 'IA', Icon: Wand2 },
  { id: 'presets', label: 'Presets', Icon: SlidersHorizontal },
];

const camadas = [
  { id: 1, nome: 'Máscara Céu', tipo: 'Máscara', visivel: true, bloqueada: false },
  { id: 2, nome: 'Correção de cor', tipo: 'Ajuste', visivel: true, bloqueada: false },
  { id: 3, nome: 'Ensaio Praia 04', tipo: 'Imagem', visivel: true, bloqueada: true },
];

const coresPaleta = ['#2B4C7E', '#A3714A', '#C4A35A', '#8B9D7A', '#D4D4D4'];

export default function EditorFoto({ onVoltar, onExportar, projeto }: Props) {
  const [ferramenta, setFerramenta] = useState<Ferramenta>(null);
  const [abaAjuste, setAbaAjuste] = useState<AbaAjuste>('Básico');
  const [abaIa, setAbaIa] = useState<AbaIa>('Recorte');
  const [abaEfeito, setAbaEfeito] = useState<AbaEfeito>('Retrô');
  const [divider, setDivider] = useState(50);
  const [modoCompar, setModoCompar] = useState(false);
  const [layersVis, setLayersVis] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
  });

  // Sliders
  const [temperatura, setTemperatura] = useState(0);
  const [matiz, setMatiz] = useState(0);
  const [saturacao, setSaturacao] = useState(20);
  const [luminosidade, setLuminosidade] = useState(0);
  const [vibracao, setVibracao] = useState(15);
  const [exposicao, setExposicao] = useState(0);
  const [nitidez, setNitidez] = useState(30);
  const [ruidoLum, setRuidoLum] = useState(25);
  const [vertical, setVertical] = useState(0);
  const [horizontal, setHorizontal] = useState(0);
  const [tamanho, setTamanho] = useState(40);
  const [dureza, setDureza] = useState(60);
  const [fluxo, setFluxo] = useState(80);
  const [opacidadeCamada, setOpacidadeCamada] = useState(100);

  const dividerRef = useRef<HTMLDivElement>(null);

  const handleDivider = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = dividerRef.current!.getBoundingClientRect();
    const update = (clientX: number) => {
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setDivider(Math.round(pct));
    };
    update(e.clientX);
    (
      e.currentTarget as Element & { onpointermove: ((ev: PointerEvent) => void) | null }
    ).onpointermove = (ev: PointerEvent) => {
      if (ev.buttons > 0) update(ev.clientX);
    };
  };

  const toggleFerramenta = (id: Ferramenta) => {
    setFerramenta((prev) => (prev === id ? null : id));
  };

  const toggleLayer = (id: number) => {
    setLayersVis((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const gavetaAberta = ferramenta !== null && ferramenta !== 'camadas';
  const panelCamadasAberto = ferramenta === 'camadas';

  const nomeArquivo = projeto || 'Ensaio Praia 04';

  const BARRA_H = 48;
  const FAIXA_H = 24;
  const TOOLBAR_H = 64;
  const GAVETA_H = 360;

  const canvasH = gavetaAberta
    ? 844 - BARRA_H - FAIXA_H - TOOLBAR_H - GAVETA_H
    : 844 - BARRA_H - FAIXA_H - TOOLBAR_H;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1A1A1A',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Barra superior */}
      <div
        style={{
          height: BARRA_H,
          background: '#252525',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          borderBottom: '1px solid #3C3C3C',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}
      >
        <button
          onClick={onVoltar}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <ChevronLeft size={22} color="#B0B0B0" />
        </button>
        <span
          style={{
            color: '#E4E4E4',
            fontSize: 14,
            fontWeight: 500,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {nomeArquivo}
          <span style={{ color: '#D2A05E', marginLeft: 4 }}>●</span>
        </span>
        <Undo2 size={20} color="#B0B0B0" strokeWidth={2} style={{ cursor: 'pointer' }} />
        <Redo2
          size={20}
          color="#B0B0B0"
          strokeWidth={2}
          style={{ cursor: 'pointer', marginLeft: 4 }}
        />
        <Columns2
          size={20}
          color={modoCompar ? '#3A8FDE' : '#B0B0B0'}
          strokeWidth={2}
          style={{ cursor: 'pointer', marginLeft: 4 }}
          onClick={() => setModoCompar(!modoCompar)}
        />
        <button
          onClick={onExportar}
          style={{
            background: '#3A8FDE',
            border: 'none',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 12px',
            cursor: 'pointer',
            marginLeft: 4,
          }}
        >
          Exportar
        </button>
      </div>

      {/* Faixa técnica */}
      <div
        style={{
          height: FAIXA_H,
          background: '#1F1F1F',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          justifyContent: 'space-between',
          borderBottom: '1px solid #3C3C3C',
        }}
      >
        <span className="mono" style={{ color: '#8E8E8E', fontSize: 10 }}>
          6000 × 4000 · Adobe RGB · 14 bits
        </span>
        <span className="mono" style={{ color: '#8E8E8E', fontSize: 10 }}>
          RAM 412 MB
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={dividerRef}
        style={{
          height: canvasH,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          background: '#111',
          transition: 'height 0.2s',
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=390&h=500&fit=crop&auto=format"
          alt="Foto editada"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            filter: `saturate(${1 + saturacao / 100}) brightness(${1 + exposicao / 100})`,
          }}
        />

        {/* Modo comparação */}
        {modoCompar && (
          <>
            {/* Lado esquerdo: original (clip) */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${divider}%`,
                height: '100%',
                overflow: 'hidden',
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=390&h=500&fit=crop&auto=format"
                alt="Original"
                style={{ width: `${100 / (divider / 100)}%`, height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  left: 8,
                  background: 'rgba(0,0,0,0.6)',
                  padding: '2px 6px',
                }}
              >
                <span style={{ color: '#fff', fontSize: 10 }}>ORIGINAL</span>
              </div>
            </div>

            {/* Divisor arrastável */}
            <div
              onPointerDown={handleDivider}
              style={{
                position: 'absolute',
                top: 0,
                left: `${divider}%`,
                width: 2,
                height: '100%',
                background: '#fff',
                cursor: 'col-resize',
                transform: 'translateX(-50%)',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: 24,
                  height: 24,
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: '#1A1A1A', fontSize: 12, fontWeight: 700 }}>⇔</span>
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                background: 'rgba(0,0,0,0.6)',
                padding: '2px 6px',
              }}
            >
              <span style={{ color: '#fff', fontSize: 10 }}>EDITADA</span>
            </div>
          </>
        )}

        {/* Barra de zoom */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)',
            padding: '3px 10px',
            display: modoCompar ? 'none' : 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span className="mono" style={{ color: '#E4E4E4', fontSize: 10 }}>
            100%
          </span>
        </div>

        {/* Painel de camadas lateral */}
        {panelCamadasAberto && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 280,
              height: '100%',
              background: '#252525',
              borderLeft: '1px solid #3C3C3C',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #3C3C3C',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ color: '#E4E4E4', fontSize: 13, fontWeight: 500, flex: 1 }}>
                Camadas
              </span>
              <button
                style={{
                  background: '#3A8FDE',
                  border: 'none',
                  color: '#fff',
                  fontSize: 11,
                  padding: '3px 8px',
                  cursor: 'pointer',
                }}
              >
                +
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {camadas.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderBottom: '1px solid #3C3C3C',
                    opacity: layersVis[c.id] ? 1 : 0.4,
                  }}
                >
                  <button
                    onClick={() => toggleLayer(c.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      flexShrink: 0,
                    }}
                  >
                    {layersVis[c.id] ? (
                      <Eye size={14} color="#B0B0B0" />
                    ) : (
                      <EyeOff size={14} color="#8E8E8E" />
                    )}
                  </button>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      background: '#3C3C3C',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=28&h=28&fit=crop"
                      alt={c.nome}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: layersVis[c.id] ? 1 : 0.3,
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#E4E4E4', fontSize: 11, fontWeight: 500 }}>{c.nome}</div>
                    <div style={{ color: '#8E8E8E', fontSize: 10 }}>{c.tipo}</div>
                  </div>
                  {c.bloqueada && <Lock size={12} color="#8E8E8E" />}
                </div>
              ))}
            </div>
            {/* Rodapé camadas */}
            <div style={{ padding: '8px 12px', borderTop: '1px solid #3C3C3C' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#8E8E8E', fontSize: 11, width: 60 }}>Opacidade</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacidadeCamada}
                  onChange={(e) => setOpacidadeCamada(+e.target.value)}
                  style={{ flex: 1, accentColor: '#3A8FDE' }}
                />
                <span
                  className="mono"
                  style={{ color: '#E4E4E4', fontSize: 11, width: 36, textAlign: 'right' }}
                >
                  {opacidadeCamada}%
                </span>
              </div>
              <select
                style={{
                  width: '100%',
                  background: '#2F2F2F',
                  border: '1px solid #3C3C3C',
                  color: '#E4E4E4',
                  fontSize: 12,
                  padding: '4px 8px',
                }}
              >
                {['Normal', 'Multiplicar', 'Tela', 'Sobrepor', 'Luz suave', 'Diferença'].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  )
                )}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Barra de ferramentas inferior */}
      <div
        style={{
          height: TOOLBAR_H,
          background: '#252525',
          flexShrink: 0,
          borderTop: '1px solid #3C3C3C',
          display: 'flex',
          alignItems: 'stretch',
          overflowX: 'auto',
        }}
      >
        {ferramentas.map(({ id, label, Icon }) => {
          const ativo = ferramenta === id;
          return (
            <button
              key={id}
              onClick={() => toggleFerramenta(id as Ferramenta)}
              style={{
                background: ativo ? 'rgba(58,143,222,0.12)' : 'transparent',
                border: 'none',
                borderTop: ativo ? '2px solid #3A8FDE' : '2px solid transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: '0 10px',
                cursor: 'pointer',
                flexShrink: 0,
                minWidth: 56,
              }}
            >
              <Icon size={22} color={ativo ? '#3A8FDE' : '#B0B0B0'} strokeWidth={2} />
              <span
                style={{
                  color: ativo ? '#3A8FDE' : '#8E8E8E',
                  fontSize: 9,
                  letterSpacing: 0.3,
                  fontWeight: 500,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Gaveta inferior */}
      {gavetaAberta && (
        <div
          style={{
            height: GAVETA_H,
            background: '#252525',
            flexShrink: 0,
            borderTop: '1px solid #3C3C3C',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Abas internas Ajustes */}
          {ferramenta === 'ajustes' && (
            <>
              <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C', flexShrink: 0 }}>
                {(['Básico', 'Curvas', 'Detalhe', 'Cor seletiva'] as AbaAjuste[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAbaAjuste(a)}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      borderBottom: abaAjuste === a ? '2px solid #3A8FDE' : '2px solid transparent',
                      color: abaAjuste === a ? '#3A8FDE' : '#8E8E8E',
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '9px 4px',
                      cursor: 'pointer',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                {abaAjuste === 'Básico' && (
                  <>
                    {/* Histograma */}
                    <div
                      style={{
                        height: 48,
                        background: '#1F1F1F',
                        marginBottom: 12,
                        position: 'relative',
                        overflow: 'hidden',
                        border: '1px solid #3C3C3C',
                      }}
                    >
                      <svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 300 48"
                        preserveAspectRatio="none"
                      >
                        <path
                          d="M0 48 C20 48 30 30 50 25 C70 20 80 10 100 8 C120 6 130 12 150 15 C170 18 180 22 200 28 C220 34 240 40 260 44 C280 47 290 48 300 48 Z"
                          fill="rgba(58,143,222,0.3)"
                          stroke="#3A8FDE"
                          strokeWidth={1}
                        />
                        <path
                          d="M0 48 C15 48 25 35 45 28 C65 21 75 12 95 10 C115 8 125 14 145 17 C165 20 175 24 195 30 C215 36 235 42 255 46 C275 47.5 285 48 300 48 Z"
                          fill="rgba(255,0,0,0.15)"
                          stroke="rgba(255,0,0,0.5)"
                          strokeWidth={0.5}
                        />
                        <path
                          d="M0 48 C20 48 28 38 48 30 C68 22 78 14 98 11 C118 8 128 15 148 18 C168 21 178 26 198 32 C218 38 238 44 258 46.5 C278 47.8 288 48 300 48 Z"
                          fill="rgba(0,255,0,0.1)"
                          stroke="rgba(0,200,0,0.5)"
                          strokeWidth={0.5}
                        />
                      </svg>
                    </div>
                    <Slider
                      label="Temperatura"
                      value={temperatura}
                      min={-100}
                      max={100}
                      bipolar
                      onChange={setTemperatura}
                      colorTrack="linear-gradient(to right, #3A8FDE, #D2A05E)"
                    />
                    <Slider
                      label="Matiz"
                      value={matiz}
                      min={-100}
                      max={100}
                      bipolar
                      onChange={setMatiz}
                    />
                    <Slider
                      label="Saturação"
                      value={saturacao}
                      min={-100}
                      max={100}
                      bipolar
                      onChange={setSaturacao}
                    />
                    <Slider
                      label="Luminosidade"
                      value={luminosidade}
                      min={-100}
                      max={100}
                      bipolar
                      onChange={setLuminosidade}
                    />
                    <Slider
                      label="Vibração"
                      value={vibracao}
                      min={-100}
                      max={100}
                      bipolar
                      onChange={setVibracao}
                    />
                    <Slider
                      label="Exposição"
                      value={exposicao}
                      min={-300}
                      max={300}
                      unit=" EV"
                      bipolar
                      onChange={setExposicao}
                    />
                  </>
                )}
                {abaAjuste === 'Curvas' && (
                  <>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                      {['RGB', 'R', 'G', 'B'].map((c, i) => (
                        <button
                          key={c}
                          style={{
                            background:
                              i === 0 ? '#E4E4E4' : ['#D25252', '#5FB98F', '#3A8FDE'][i - 1],
                            border: 'none',
                            color: '#fff',
                            fontSize: 10,
                            padding: '3px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    {/* Editor de curvas */}
                    <div
                      style={{
                        position: 'relative',
                        background: '#1F1F1F',
                        border: '1px solid #3C3C3C',
                        marginBottom: 8,
                      }}
                    >
                      <svg width="100%" height="220" viewBox="0 0 280 220">
                        {/* Grade */}
                        {[1, 2, 3].map((i) => (
                          <>
                            <line
                              key={`h${i}`}
                              x1={0}
                              y1={i * 55}
                              x2={280}
                              y2={i * 55}
                              stroke="#3C3C3C"
                              strokeWidth={0.5}
                            />
                            <line
                              key={`v${i}`}
                              x1={i * 70}
                              y1={0}
                              x2={i * 70}
                              y2={220}
                              stroke="#3C3C3C"
                              strokeWidth={0.5}
                            />
                          </>
                        ))}
                        {/* Diagonal */}
                        <line
                          x1={0}
                          y1={220}
                          x2={280}
                          y2={0}
                          stroke="#3C3C3C"
                          strokeWidth={0.5}
                          strokeDasharray="4"
                        />
                        {/* Histograma fundo */}
                        <path
                          d="M0 220 C30 220 50 180 80 150 C110 120 120 90 140 70 C160 50 170 60 200 80 C230 100 250 160 280 220 Z"
                          fill="rgba(58,143,222,0.1)"
                        />
                        {/* Curva S */}
                        <path
                          d="M0 220 C40 200 60 160 100 120 C140 80 180 50 220 30 C250 15 270 5 280 0"
                          fill="none"
                          stroke="#3A8FDE"
                          strokeWidth={2}
                        />
                        {/* Pontos de controle */}
                        {[
                          [70, 155],
                          [140, 110],
                          [210, 55],
                        ].map(([cx, cy], i) => (
                          <circle
                            key={i}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill="#E4E4E4"
                            stroke="#3A8FDE"
                            strokeWidth={1.5}
                            style={{ cursor: 'grab' }}
                          />
                        ))}
                      </svg>
                    </div>
                  </>
                )}
                {abaAjuste === 'Detalhe' && (
                  <>
                    <div
                      style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                    >
                      NITIDEZ
                    </div>
                    <Slider
                      label="Intensidade"
                      value={nitidez}
                      min={0}
                      max={100}
                      onChange={setNitidez}
                    />
                    <div
                      style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, margin: '8px 0' }}
                    >
                      REDUÇÃO DE RUÍDO
                    </div>
                    <Slider
                      label="Luminância"
                      value={ruidoLum}
                      min={0}
                      max={100}
                      onChange={setRuidoLum}
                    />
                    <Slider label="Cor" value={20} min={0} max={100} onChange={() => {}} />
                  </>
                )}
                {abaAjuste === 'Cor seletiva' && (
                  <>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      {['Vermelhos', 'Laranjas', 'Amarelos', 'Verdes', 'Azuis', 'Roxos'].map(
                        (c) => (
                          <div
                            key={c}
                            style={{
                              width: 32,
                              height: 32,
                              cursor: 'pointer',
                              background: {
                                Vermelhos: '#D25252',
                                Laranjas: '#D2A05E',
                                Amarelos: '#D4D400',
                                Verdes: '#5FB98F',
                                Azuis: '#3A8FDE',
                                Roxos: '#8B5CF6',
                              }[c],
                              border: '2px solid transparent',
                            }}
                          />
                        )
                      )}
                    </div>
                    <Slider
                      label="Matiz"
                      value={0}
                      min={-100}
                      max={100}
                      bipolar
                      onChange={() => {}}
                    />
                    <Slider
                      label="Saturação"
                      value={0}
                      min={-100}
                      max={100}
                      bipolar
                      onChange={() => {}}
                    />
                    <Slider
                      label="Luminância"
                      value={0}
                      min={-100}
                      max={100}
                      bipolar
                      onChange={() => {}}
                    />
                  </>
                )}
              </div>
            </>
          )}

          {/* Geometria */}
          {ferramenta === 'geometria' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              <div style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
                PERSPECTIVA
              </div>
              <Slider
                label="Vertical"
                value={vertical}
                min={-100}
                max={100}
                bipolar
                onChange={setVertical}
              />
              <Slider
                label="Horizontal"
                value={horizontal}
                min={-100}
                max={100}
                bipolar
                onChange={setHorizontal}
              />
              <div
                style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, margin: '12px 0 8px' }}
              >
                ROTAÇÃO
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {['90°', '180°', '270°', 'Auto EXIF'].map((r) => (
                  <button
                    key={r}
                    style={{
                      background: 'transparent',
                      border: '1px solid #3C3C3C',
                      color: '#E4E4E4',
                      fontSize: 11,
                      padding: '5px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
                ESPELHAMENTO
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {['↔ Horizontal', '↕ Vertical'].map((e) => (
                  <button
                    key={e}
                    style={{
                      background: 'transparent',
                      border: '1px solid #3C3C3C',
                      color: '#E4E4E4',
                      fontSize: 11,
                      padding: '5px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div style={{ background: '#2F2F2F', border: '1px solid #3C3C3C', padding: 10 }}>
                <div style={{ color: '#D2A05E', fontSize: 11, marginBottom: 4 }}>Sugestão</div>
                <div style={{ color: '#8E8E8E', fontSize: 11 }}>
                  Corte pela regra dos terços para melhor composição
                </div>
              </div>
            </div>
          )}

          {/* Máscaras */}
          {ferramenta === 'mascaras' && (
            <>
              <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C', flexShrink: 0 }}>
                {['Pincel', 'Cor', 'Foco', 'Gradiente'].map((a) => (
                  <button
                    key={a}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      borderBottom: a === 'Pincel' ? '2px solid #3A8FDE' : '2px solid transparent',
                      color: a === 'Pincel' ? '#3A8FDE' : '#8E8E8E',
                      fontSize: 11,
                      padding: '9px 4px',
                      cursor: 'pointer',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                <Slider
                  label="Tamanho"
                  value={tamanho}
                  min={5}
                  max={200}
                  unit="px"
                  onChange={setTamanho}
                />
                <Slider
                  label="Dureza"
                  value={dureza}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={setDureza}
                />
                <Slider
                  label="Fluxo"
                  value={fluxo}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={setFluxo}
                />
                <Slider
                  label="Tolerância"
                  value={30}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={() => {}}
                />
                <div
                  style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, margin: '10px 0 6px' }}
                >
                  AJUSTES NA MÁSCARA
                </div>
                <Slider
                  label="Exposição"
                  value={exposicao}
                  min={-100}
                  max={100}
                  bipolar
                  onChange={setExposicao}
                />
                <Slider
                  label="Saturação"
                  value={saturacao}
                  min={-100}
                  max={100}
                  bipolar
                  onChange={setSaturacao}
                />
                <div
                  style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, margin: '10px 0 6px' }}
                >
                  MÁSCARAS
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['Céu', 'Rosto', 'Objeto'].map((m, i) => (
                    <div
                      key={m}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          background: '#3C3C3C',
                          border: '1px solid #3C3C3C',
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=44&h=44&fit=crop"
                          alt={m}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            opacity: 0.6,
                            filter: 'grayscale(1)',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Eye size={10} color="#B0B0B0" />
                        <span style={{ color: '#8E8E8E', fontSize: 9 }}>{m}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Retoque */}
          {ferramenta === 'retoque' && (
            <>
              <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C', flexShrink: 0 }}>
                {['Clonagem', 'Liquify'].map((a) => (
                  <button
                    key={a}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      borderBottom:
                        a === 'Clonagem' ? '2px solid #3A8FDE' : '2px solid transparent',
                      color: a === 'Clonagem' ? '#3A8FDE' : '#8E8E8E',
                      fontSize: 11,
                      padding: '9px 4px',
                      cursor: 'pointer',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                <div style={{ color: '#8E8E8E', fontSize: 11, marginBottom: 8 }}>
                  Arraste para definir área de origem
                </div>
                <Slider
                  label="Tamanho"
                  value={tamanho}
                  min={5}
                  max={200}
                  unit="px"
                  onChange={setTamanho}
                />
                <Slider
                  label="Dureza"
                  value={dureza}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={setDureza}
                />
                <Slider
                  label="Opacidade"
                  value={80}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={() => {}}
                />
              </div>
            </>
          )}

          {/* Efeitos */}
          {ferramenta === 'efeitos' && (
            <>
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid #3C3C3C',
                  flexShrink: 0,
                  overflowX: 'auto',
                }}
              >
                {(
                  ['Retrô', 'Molduras', 'Iluminação', 'Dupla exposição', 'Overlays'] as AbaEfeito[]
                ).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAbaEfeito(a)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: abaEfeito === a ? '2px solid #3A8FDE' : '2px solid transparent',
                      color: abaEfeito === a ? '#3A8FDE' : '#8E8E8E',
                      fontSize: 11,
                      padding: '9px 10px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  {['Vintage', 'Kodak', 'Fuji', 'LoFi', 'Fade', 'Matte', 'Grain', 'Vignette'].map(
                    (ef) => (
                      <div
                        key={ef}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '1',
                            background: '#3C3C3C',
                            overflow: 'hidden',
                          }}
                        >
                          <img
                            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=60&h=60&fit=crop"
                            alt={ef}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              opacity: 0.7,
                            }}
                          />
                        </div>
                        <span style={{ color: '#8E8E8E', fontSize: 9 }}>{ef}</span>
                      </div>
                    )
                  )}
                </div>
                <Slider
                  label="Intensidade"
                  value={60}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={() => {}}
                />
                <Slider
                  label="Mesclagem"
                  value={80}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={() => {}}
                />
                <select
                  style={{
                    width: '100%',
                    background: '#2F2F2F',
                    border: '1px solid #3C3C3C',
                    color: '#E4E4E4',
                    fontSize: 12,
                    padding: '6px 8px',
                    marginTop: 8,
                  }}
                >
                  {['Normal', 'Multiplicar', 'Tela', 'Sobrepor'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Elementos */}
          {ferramenta === 'elementos' && (
            <>
              <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C', flexShrink: 0 }}>
                {['Texto', 'Formas', 'Adesivos', 'Meme', 'Colagem'].map((a) => (
                  <button
                    key={a}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      borderBottom: a === 'Texto' ? '2px solid #3A8FDE' : '2px solid transparent',
                      color: a === 'Texto' ? '#3A8FDE' : '#8E8E8E',
                      fontSize: 10,
                      padding: '9px 2px',
                      cursor: 'pointer',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {['Roboto', 'Merriweather', 'Oswald', 'Pacifico', 'Courier'].map((f) => (
                    <div
                      key={f}
                      style={{
                        background: '#2F2F2F',
                        border: '1px solid #3C3C3C',
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ color: '#E4E4E4', fontSize: 12, fontFamily: f }}>
                        {f.slice(0, 3)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {['#E4E4E4', '#D25252', '#3A8FDE', '#5FB98F', '#D2A05E', '#000'].map((cor) => (
                    <div
                      key={cor}
                      style={{
                        width: 24,
                        height: 24,
                        background: cor,
                        cursor: 'pointer',
                        border: '1px solid #3C3C3C',
                      }}
                    />
                  ))}
                </div>
                <div style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>
                  ANIMAÇÃO
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {['Fade', 'Deslizar', 'Escalar', 'Girar'].map((a) => (
                    <button
                      key={a}
                      style={{
                        background: '#2F2F2F',
                        border: '1px solid #3C3C3C',
                        color: '#E4E4E4',
                        fontSize: 11,
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <Slider
                  label="Entrada"
                  value={0}
                  min={0}
                  max={5000}
                  unit="ms"
                  onChange={() => {}}
                />
                <Slider
                  label="Saída"
                  value={500}
                  min={0}
                  max={5000}
                  unit="ms"
                  onChange={() => {}}
                />
              </div>
            </>
          )}

          {/* IA */}
          {ferramenta === 'ia' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  borderBottom: '1px solid #3C3C3C',
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <span style={{ color: '#E4E4E4', fontSize: 13, fontWeight: 500 }}>IA</span>
                <div
                  style={{
                    background: '#1F1F1F',
                    border: '1px solid #5FB98F',
                    padding: '2px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div
                    style={{ width: 6, height: 6, background: '#5FB98F', borderRadius: '50%' }}
                  />
                  <span style={{ color: '#5FB98F', fontSize: 10, fontWeight: 500 }}>
                    No dispositivo
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C', flexShrink: 0 }}>
                {(['Recorte', 'Retrato', 'Sugestões', 'Artístico'] as AbaIa[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAbaIa(a)}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      borderBottom: abaIa === a ? '2px solid #3A8FDE' : '2px solid transparent',
                      color: abaIa === a ? '#3A8FDE' : '#8E8E8E',
                      fontSize: 10,
                      padding: '9px 2px',
                      cursor: 'pointer',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                {abaIa === 'Recorte' && (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                        marginBottom: 16,
                      }}
                    >
                      {[
                        'Remover fundo',
                        'Substituir fundo',
                        'Remover objeto',
                        'Preencher área',
                      ].map((a) => (
                        <button
                          key={a}
                          style={{
                            background: '#2F2F2F',
                            border: '1px solid #3C3C3C',
                            color: '#E4E4E4',
                            fontSize: 12,
                            fontWeight: 500,
                            padding: '12px 8px',
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                    <div
                      style={{
                        background: '#1F1F1F',
                        border: '1px solid #3C3C3C',
                        padding: 10,
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ color: '#8E8E8E', fontSize: 11 }}>Cena detectada</span>
                        <span className="mono" style={{ color: '#5FB98F', fontSize: 11 }}>
                          2,3 s
                        </span>
                      </div>
                      <div
                        style={{
                          background: '#2F2F2F',
                          border: '1px solid #3C3C3C',
                          padding: '4px 8px',
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ color: '#3A8FDE', fontSize: 12 }}>
                          🌅 Praia ao entardecer
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['Dourado', 'Vívido', 'Frio'].map((s) => (
                          <button
                            key={s}
                            style={{
                              background: '#3C3C3C',
                              border: 'none',
                              color: '#E4E4E4',
                              fontSize: 10,
                              padding: '3px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                    >
                      PALETA DOMINANTE
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {coresPaleta.map((cor) => (
                        <div
                          key={cor}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <div style={{ width: '100%', height: 24, background: cor }} />
                          <span className="mono" style={{ color: '#8E8E8E', fontSize: 8 }}>
                            {cor.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {abaIa !== 'Recorte' && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px 0',
                      color: '#8E8E8E',
                      fontSize: 13,
                    }}
                  >
                    Selecione uma área na imagem para começar
                  </div>
                )}
              </div>
            </>
          )}

          {/* Presets */}
          {ferramenta === 'presets' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              <button
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px dashed #3C3C3C',
                  color: '#3A8FDE',
                  fontSize: 13,
                  padding: '10px 0',
                  cursor: 'pointer',
                  marginBottom: 12,
                }}
              >
                + Salvar ajustes atuais como preset
              </button>
              {['Praia dourada', 'Retrato suave', 'Urbano P&B', 'Cine fade', 'Serra verde'].map(
                (p) => (
                  <div
                    key={p}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 0',
                      borderBottom: '1px solid #3C3C3C',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        background: '#3C3C3C',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=44&h=44&fit=crop"
                        alt={p}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                      />
                    </div>
                    <span style={{ color: '#E4E4E4', fontSize: 13, flex: 1 }}>{p}</span>
                    <span className="mono" style={{ color: '#8E8E8E', fontSize: 10 }}>
                      Aplicar
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
