import { useState, useRef } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
  onOpenDrawer: () => void;
}

const TABS = ['MEUS PRESETS', 'DA COMUNIDADE'];

interface Preset {
  id: number;
  name: string;
  adjustments: number;
  uses: number;
  img: string;
  filter: string;
  details: { label: string; value: string }[];
}

const presets: Preset[] = [
  {
    id: 1,
    name: 'Praia Quente',
    adjustments: 6,
    uses: 23,
    img: 'photo-1507525428034-b723cf961d3e',
    filter: 'saturate(1.4) hue-rotate(12deg) brightness(1.1)',
    details: [
      { label: 'Temperatura', value: '+12' },
      { label: 'Saturação', value: '+25' },
      { label: 'Vibração', value: '+8' },
      { label: 'Exposição', value: '-0,3' },
      { label: 'Vinheta', value: '40' },
      { label: 'Granulado', value: '15' },
    ],
  },
  {
    id: 2,
    name: 'Preto e Branco',
    adjustments: 3,
    uses: 11,
    img: 'photo-1531746020798-e6953c6e8e04',
    filter: 'grayscale(1) contrast(1.1)',
    details: [
      { label: 'Saturação', value: '-100' },
      { label: 'Contraste', value: '+15' },
      { label: 'Vinheta', value: '25' },
    ],
  },
  {
    id: 3,
    name: 'Retrô 400',
    adjustments: 8,
    uses: 7,
    img: 'photo-1469474968028-56623f02e42e',
    filter: 'sepia(0.35) saturate(0.75) contrast(1.12)',
    details: [
      { label: 'Temperatura', value: '+8' },
      { label: 'Saturação', value: '-25' },
      { label: 'Contraste', value: '+12' },
      { label: 'Exposição', value: '+0,2' },
      { label: 'Desvanecer', value: '20' },
      { label: 'Vinheta', value: '30' },
      { label: 'Granulado', value: '40' },
      { label: 'Matiz', value: '+5' },
    ],
  },
  {
    id: 4,
    name: 'Alto Contraste',
    adjustments: 4,
    uses: 4,
    img: 'photo-1504700610630-ac6aba3536d3',
    filter: 'contrast(1.5) brightness(0.9)',
    details: [
      { label: 'Contraste', value: '+50' },
      { label: 'Exposição', value: '-0,5' },
      { label: 'Realces', value: '-30' },
      { label: 'Sombras', value: '+20' },
    ],
  },
  {
    id: 5,
    name: 'Pele Suave',
    adjustments: 5,
    uses: 19,
    img: 'photo-1558618666-fcd25c85cd64',
    filter: 'saturate(0.9) brightness(1.05) contrast(0.95)',
    details: [
      { label: 'Temperatura', value: '+5' },
      { label: 'Saturação', value: '-10' },
      { label: 'Suavidade', value: '60' },
      { label: 'Clareza', value: '-15' },
      { label: 'Exposição', value: '+0,1' },
    ],
  },
  {
    id: 6,
    name: 'Luz Dourada',
    adjustments: 7,
    uses: 15,
    img: 'photo-1555396273-367ea4eb4db5',
    filter: 'sepia(0.2) saturate(1.3) hue-rotate(-10deg) brightness(1.08)',
    details: [
      { label: 'Temperatura', value: '+22' },
      { label: 'Tinta', value: '+4' },
      { label: 'Exposição', value: '+0,3' },
      { label: 'Realces', value: '-20' },
      { label: 'Saturação', value: '+18' },
      { label: 'Vibração', value: '+12' },
      { label: 'Vinheta', value: '20' },
    ],
  },
];

export default function PresetsScreen({ onOpenDrawer }: Props) {
  const [activeTab, setActiveTab] = useState('MEUS PRESETS');
  const [contextPreset, setContextPreset] = useState<Preset | null>(null);
  const [sheetPreset, setSheetPreset] = useState<Preset | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  const handlePointerDown = (preset: Preset) => {
    longPressTimer.current = setTimeout(() => setContextPreset(preset), 500);
  };
  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1A1A1A', position: 'relative' }}>
      {/* Top bar */}
      <div style={{ height: 52, background: '#252525', borderBottom: '1px solid #3C3C3C', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
        <button onClick={onOpenDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Icon name="menu" size={22} color="#B0B0B0" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#E4E4E4', flex: 1 }}>Presets</span>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Icon name="search" size={20} color="#B0B0B0" />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C', background: '#252525', flexShrink: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              height: 40,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.06em',
              color: activeTab === tab ? '#3A8FDE' : '#8E8E8E',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab ? '#3A8FDE' : 'transparent'}`,
              cursor: 'pointer',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {presets.map(preset => (
            <button
              key={preset.id}
              onPointerDown={() => handlePointerDown(preset)}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onClick={() => setSheetPreset(preset)}
              style={{
                background: '#2F2F2F',
                border: '1px solid #3C3C3C',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'left',
              }}
            >
              {/* Thumbnail */}
              <div style={{ height: 100, overflow: 'hidden', position: 'relative' }}>
                <img
                  src={`https://images.unsplash.com/${preset.img}?w=180&h=100&fit=crop&auto=format`}
                  alt={preset.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: preset.filter }}
                />
              </div>
              <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ fontSize: 13, color: '#E4E4E4', marginBottom: 3 }}>{preset.name}</div>
                <div style={{ ...M, fontSize: 11, color: '#8E8E8E' }}>
                  {preset.adjustments} ajustes · usado {preset.uses}x
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* FAB */}
      <button
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          height: 40,
          padding: '0 16px',
          background: '#3A8FDE',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: '#fff',
          fontWeight: 500,
        }}
      >
        <Icon name="plus" size={16} color="#fff" />
        Novo preset
      </button>

      {/* Context menu */}
      {contextPreset && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }} onClick={() => setContextPreset(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#252525',
              border: '1px solid #3C3C3C',
              width: 200,
              zIndex: 1,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #3C3C3C', fontSize: 13, color: '#E4E4E4', fontWeight: 500 }}>
              {contextPreset.name}
            </div>
            {[
              { label: 'Renomear', color: '#E4E4E4' },
              { label: 'Duplicar', color: '#E4E4E4' },
              { label: 'Exportar', color: '#E4E4E4' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => setContextPreset(null)}
                style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: item.color, textAlign: 'left', borderBottom: '1px solid #3C3C3C' }}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => setContextPreset(null)}
              style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#D25252', textAlign: 'left' }}
            >
              Excluir
            </button>
          </div>
        </div>
      )}

      {/* Bottom sheet */}
      {sheetPreset && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }} onClick={() => setSheetPreset(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#252525',
              borderTop: '1px solid #3C3C3C',
              zIndex: 1,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #3C3C3C', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#E4E4E4' }}>{sheetPreset.name}</span>
              <button onClick={() => setSheetPreset(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <Icon name="x" size={18} color="#8E8E8E" />
              </button>
            </div>
            {/* Details */}
            <div style={{ padding: '8px 0' }}>
              {sheetPreset.details.map(d => (
                <div
                  key={d.label}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #3C3C3C' }}
                >
                  <span style={{ fontSize: 13, color: '#E4E4E4' }}>{d.label}</span>
                  <span style={{ ...M, fontSize: 13, color: '#3A8FDE' }}>{d.value}</span>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div style={{ display: 'flex', gap: 10, padding: '12px 16px 20px' }}>
              <button
                onClick={() => setSheetPreset(null)}
                style={{ flex: 1, height: 40, background: 'none', border: '1px solid #3C3C3C', color: '#E4E4E4', fontSize: 13, cursor: 'pointer' }}
              >
                Aplicar a uma mídia
              </button>
              <button
                onClick={() => setSheetPreset(null)}
                style={{ flex: 1, height: 40, background: '#3A8FDE', border: 'none', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Aplicar em lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
