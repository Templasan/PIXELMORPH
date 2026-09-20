import { useState } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
  onOpenDrawer: () => void;
}

const categories = [
  { icon: 'folder', label: 'Projetos', size: '2,8 GB', action: null },
  { icon: 'image', label: 'Rascunhos', size: '410 MB', action: null },
  { icon: 'film', label: 'Cache de pré-visualização', size: '680 MB', action: 'Limpar' },
  { icon: 'download', label: 'Recursos extras', size: '340 MB', action: 'Gerenciar' },
  { icon: 'save', label: 'Backups', size: '120 MB', action: null },
  { icon: 'info', label: 'Registros de erro', size: '4,1 MB', action: 'Limpar' },
];

const onDemand = [
  { label: 'Filtros artísticos', size: '140 MB' },
  { label: 'Overlays e texturas', size: '120 MB' },
  { label: 'Modelos de IA local', size: '80 MB' },
];

const segmentColors = ['#3A8FDE', '#5FB98F', '#D2A05E', '#8E5FB9', '#D25252'];
const segmentLabels = ['Projetos', 'Rascunhos', 'Cache', 'Recursos', 'Outros'];
const segmentWidths = [40, 8, 14, 7, 3];

export default function StorageScreen({ onOpenDrawer }: Props) {
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [reportsEnabled, setReportsEnabled] = useState(true);
  const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
    return (
      <button
        onClick={onChange}
        style={{
          width: 40,
          height: 22,
          background: on ? '#3A8FDE' : '#3C3C3C',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: on ? 'flex-end' : 'flex-start',
          flexShrink: 0,
        }}
      >
        <div style={{ width: 18, height: 18, background: '#fff' }} />
      </button>
    );
  }

  function SectionHeader({ label }: { label: string }) {
    return (
      <div
        style={{
          padding: '14px 16px 6px',
          fontSize: 11,
          letterSpacing: '0.08em',
          color: '#8E8E8E',
        }}
      >
        {label}
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1A1A1A' }}
    >
      {/* Top bar */}
      <div
        style={{
          height: 52,
          background: '#252525',
          borderBottom: '1px solid #3C3C3C',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onOpenDrawer}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <Icon name="menu" size={22} color="#B0B0B0" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#E4E4E4' }}>Armazenamento</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Usage bar */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #3C3C3C' }}>
          <div style={{ fontSize: 14, color: '#E4E4E4', marginBottom: 10 }}>
            4,2 GB de 10 GB usados
          </div>
          {/* Segmented bar */}
          <div
            style={{ display: 'flex', height: 12, overflow: 'hidden', gap: 1, marginBottom: 10 }}
          >
            {segmentWidths.map((w, i) => (
              <div
                key={i}
                style={{ width: `${w}%`, height: '100%', background: segmentColors[i] }}
              />
            ))}
            <div style={{ flex: 1, background: '#2F2F2F', border: '1px solid #3C3C3C' }} />
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            {segmentLabels.map((label, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, background: segmentColors[i] }} />
                <span style={{ fontSize: 11, color: '#8E8E8E' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div>
          {categories.map((cat) => (
            <div
              key={cat.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '1px solid #3C3C3C',
                gap: 12,
              }}
            >
              <Icon name={cat.icon} size={18} color="#B0B0B0" />
              <span style={{ flex: 1, fontSize: 13, color: '#E4E4E4' }}>{cat.label}</span>
              <span style={{ ...M, fontSize: 13, color: '#8E8E8E' }}>{cat.size}</span>
              {cat.action && (
                <button
                  style={{
                    marginLeft: 10,
                    fontSize: 12,
                    color: '#3A8FDE',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat.action}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* On demand */}
        <SectionHeader label="RECURSOS SOB DEMANDA" />
        <div style={{ padding: '0 16px 10px', borderBottom: '1px solid #3C3C3C' }}>
          <p style={{ fontSize: 11, color: '#8E8E8E', lineHeight: 1.5, marginBottom: 10 }}>
            O app ocupa 180 MB na instalação. Filtros, overlays e modelos de IA são baixados
            conforme o uso.
          </p>
          {onDemand.map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                paddingTop: 10,
                paddingBottom: 10,
                borderTop: '1px solid #3C3C3C',
              }}
            >
              <span style={{ flex: 1, fontSize: 13, color: '#E4E4E4' }}>{item.label}</span>
              <span style={{ ...M, fontSize: 13, color: '#8E8E8E', marginRight: 12 }}>
                {item.size}
              </span>
              <button
                style={{
                  fontSize: 12,
                  color: '#D25252',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        {/* Backup */}
        <SectionHeader label="BACKUP" />
        <div style={{ borderTop: '1px solid #3C3C3C', borderBottom: '1px solid #3C3C3C' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#E4E4E4' }}>Backup automático</div>
              <div style={{ fontSize: 11, color: '#8E8E8E', marginTop: 2 }}>
                Último backup: hoje, 13:40
              </div>
            </div>
            <Toggle on={backupEnabled} onChange={() => setBackupEnabled((v) => !v)} />
          </div>
          <div style={{ padding: '0 16px 14px' }}>
            <button
              style={{
                width: '100%',
                height: 38,
                background: 'none',
                border: '1px solid #3C3C3C',
                color: '#E4E4E4',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Verificar integridade dos projetos
            </button>
          </div>
        </div>

        {/* Diagnostics */}
        <SectionHeader label="DIAGNÓSTICO" />
        <div style={{ borderTop: '1px solid #3C3C3C' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              gap: 12,
              borderBottom: '1px solid #3C3C3C',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#E4E4E4' }}>Registros locais</div>
              <div style={{ fontSize: 11, color: '#8E8E8E', marginTop: 2 }}>
                Limitados a 5 MB com rotação automática
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
            <span style={{ flex: 1, fontSize: 13, color: '#E4E4E4' }}>
              Enviar relatórios anonimamente
            </span>
            <Toggle on={reportsEnabled} onChange={() => setReportsEnabled((v) => !v)} />
          </div>
        </div>
      </div>
    </div>
  );
}
