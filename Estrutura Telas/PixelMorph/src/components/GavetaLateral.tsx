import {
  X,
  Grid,
  Camera,
  Users,
  PlayCircle,
  Sliders,
  HardDrive,
  Settings,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import Switch from './Switch';

type Tela = 'login' | 'projetos' | 'camera' | 'editorFoto' | 'editorVideo' | 'comunidade';

interface Props {
  onFechar: () => void;
  onNavegar: (tela: Tela) => void;
  tela: Tela;
}

const I = '#B0B0B0';
const IA = '#3A8FDE';

const itens = [
  { id: 'projetos', label: 'Projetos', Icon: Grid },
  { id: 'camera', label: 'Câmera', Icon: Camera },
  { id: 'comunidade', label: 'Comunidade', Icon: Users },
  { id: 'tutoriais', label: 'Tutoriais', Icon: PlayCircle },
  { id: 'presets', label: 'Presets', Icon: Sliders },
  { id: 'armazenamento', label: 'Armazenamento', Icon: HardDrive },
  { id: 'conta', label: 'Conta e preferências', Icon: Settings },
  { id: 'ajuda', label: 'Ajuda', Icon: HelpCircle },
];

export default function GavetaLateral({ onFechar, onNavegar, tela }: Props) {
  const [mostrarConta, setMostrarConta] = useState(false);
  const [autoSalvar, setAutoSalvar] = useState(true);
  const [backup, setBackup] = useState(false);
  const [diagnostico, setDiagnostico] = useState(true);

  const handleItem = (id: string) => {
    if (id === 'conta') {
      setMostrarConta(true);
      return;
    }
    if (id === 'tutoriais' || id === 'presets' || id === 'armazenamento' || id === 'ajuda') return;
    onNavegar(id as Tela);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex' }}>
      {/* Véu */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }}
        onClick={onFechar}
      />
      {/* Gaveta */}
      <div
        style={{
          position: 'relative',
          width: '80%',
          height: '100%',
          background: '#252525',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #3C3C3C',
        }}
      >
        {/* Cabeçalho de perfil */}
        <div style={{ padding: '48px 16px 16px', borderBottom: '1px solid #3C3C3C' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: '#3A8FDE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              JS
            </div>
            <div>
              <div style={{ color: '#E4E4E4', fontSize: 16, fontWeight: 500 }}>João Silva</div>
              <div style={{ color: '#8E8E8E', fontSize: 12 }}>joao@pixelmorph.app</div>
            </div>
            <button
              onClick={onFechar}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={20} color={I} />
            </button>
          </div>
        </div>

        {mostrarConta ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <button
              onClick={() => setMostrarConta(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#3A8FDE',
                fontSize: 13,
                marginBottom: 16,
                padding: 0,
              }}
            >
              ← Voltar
            </button>
            <div style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
              CONTA
            </div>
            <div
              style={{
                background: '#2F2F2F',
                border: '1px solid #3C3C3C',
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ color: '#E4E4E4', fontSize: 14, marginBottom: 4 }}>João Silva</div>
              <div style={{ color: '#8E8E8E', fontSize: 12 }}>joao@pixelmorph.app</div>
              <div style={{ color: '#3A8FDE', fontSize: 12, marginTop: 8, cursor: 'pointer' }}>
                Editar perfil
              </div>
            </div>
            <div style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
              IDIOMA
            </div>
            <div
              style={{
                background: '#2F2F2F',
                border: '1px solid #3C3C3C',
                padding: 12,
                marginBottom: 16,
              }}
            >
              {['Português', 'English', 'Español'].map((lang, i) => (
                <div
                  key={lang}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: i < 2 ? '1px solid #3C3C3C' : 'none',
                  }}
                >
                  <span style={{ color: '#E4E4E4', fontSize: 14 }}>{lang}</span>
                  {i === 0 && (
                    <div
                      style={{ width: 8, height: 8, background: '#3A8FDE', borderRadius: '50%' }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
              SALVAMENTO E BACKUP
            </div>
            <div
              style={{
                background: '#2F2F2F',
                border: '1px solid #3C3C3C',
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Switch label="Auto-salvar" value={autoSalvar} onChange={setAutoSalvar} />
              <div style={{ borderTop: '1px solid #3C3C3C', margin: '8px 0' }} />
              <Switch label="Backup na nuvem" value={backup} onChange={setBackup} />
            </div>
            <div style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
              DIAGNÓSTICO E ARMAZENAMENTO
            </div>
            <div style={{ background: '#2F2F2F', border: '1px solid #3C3C3C', padding: 12 }}>
              <Switch label="Enviar diagnóstico" value={diagnostico} onChange={setDiagnostico} />
              <div style={{ borderTop: '1px solid #3C3C3C', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#E4E4E4', fontSize: 14 }}>Cache</span>
                <span className="mono" style={{ color: '#8E8E8E', fontSize: 12 }}>
                  1,2 GB
                </span>
              </div>
              <div style={{ color: '#3A8FDE', fontSize: 12, marginTop: 8, cursor: 'pointer' }}>
                Limpar cache
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {itens.map(({ id, label, Icon }) => {
              const ativo = tela === id;
              return (
                <div
                  key={id}
                  onClick={() => handleItem(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderBottom: '1px solid #3C3C3C',
                    cursor: 'pointer',
                    background: ativo ? 'rgba(58,143,222,0.08)' : 'transparent',
                  }}
                >
                  <Icon size={20} color={ativo ? IA : I} strokeWidth={2} />
                  <span style={{ color: ativo ? '#3A8FDE' : '#E4E4E4', fontSize: 14, flex: 1 }}>
                    {label}
                  </span>
                  <ChevronRight size={14} color="#3C3C3C" />
                </div>
              );
            })}
          </div>
        )}

        {/* Barra de armazenamento */}
        {!mostrarConta && (
          <div style={{ padding: 16, borderTop: '1px solid #3C3C3C' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#8E8E8E', fontSize: 11 }}>ARMAZENAMENTO</span>
              <span className="mono" style={{ color: '#8E8E8E', fontSize: 11 }}>
                4,2 GB de 10 GB usados
              </span>
            </div>
            <div style={{ height: 2, background: '#3C3C3C' }}>
              <div style={{ width: '42%', height: '100%', background: '#3A8FDE' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
