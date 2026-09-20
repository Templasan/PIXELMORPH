import { useState } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{ padding: '16px 16px 6px', fontSize: 11, letterSpacing: '0.08em', color: '#8E8E8E' }}
    >
      {label}
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  action,
  onAction,
}: {
  label: string;
  value?: string;
  sub?: string;
  action: 'arrow' | 'toggle';
  onAction?: () => void;
}) {
  const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
  return (
    <button
      onClick={onAction}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        minHeight: 56,
        padding: sub ? '10px 16px' : '0 16px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid #3C3C3C',
        cursor: action === 'arrow' ? 'pointer' : 'default',
        textAlign: 'left',
        gap: 0,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: '#E4E4E4' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#8E8E8E', marginTop: 2 }}>{sub}</div>}
      </div>
      {value && action === 'arrow' && (
        <span style={{ ...M, fontSize: 12, color: '#8E8E8E', marginRight: 6 }}>{value}</span>
      )}
      {value && action === 'toggle' && (
        <span style={{ ...M, fontSize: 12, color: '#8E8E8E', marginRight: 8 }}>{value}</span>
      )}
      {action === 'arrow' && <Icon name="chevronRight" size={16} color="#3C3C3C" />}
      {action === 'toggle' && <ToggleCtrl />}
    </button>
  );
}

function ToggleCtrl() {
  const [on, setOn] = useState(true);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setOn((v) => !v);
      }}
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

export default function AccountScreen({ navigate }: Props) {
  const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

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
          onClick={() => navigate('projects')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <Icon name="chevronLeft" size={22} color="#B0B0B0" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#E4E4E4' }}>
          Conta e preferências
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* CONTA */}
        <SectionHeader label="CONTA" />
        <div style={{ borderTop: '1px solid #3C3C3C' }}>
          {/* Profile row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 16px',
              borderBottom: '1px solid #3C3C3C',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#3A8FDE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 16,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              JS
            </div>
            <div>
              <div style={{ fontSize: 16, color: '#E4E4E4', fontWeight: 500 }}>João Silva</div>
              <div style={{ fontSize: 12, color: '#8E8E8E', marginTop: 2 }}>
                joao@pixelmorph.com
              </div>
            </div>
          </div>
          <Row label="Alterar senha" action="arrow" />
          <Row label="Verificação em duas etapas" value="App autenticador" action="toggle" />
          <Row label="Dispositivos conectados" value="3 ativos" action="arrow" />
        </div>

        {/* IDIOMA */}
        <SectionHeader label="IDIOMA" />
        <div style={{ borderTop: '1px solid #3C3C3C' }}>
          <Row label="Idioma do app" value="Português (Brasil)" action="arrow" />
          <div style={{ padding: '8px 16px 14px', borderBottom: '1px solid #3C3C3C' }}>
            <span style={{ fontSize: 11, color: '#8E8E8E', lineHeight: 1.5 }}>
              Inglês e Espanhol disponíveis. Outros idiomas são baixados sob demanda.
            </span>
          </div>
        </div>

        {/* EDIÇÃO */}
        <SectionHeader label="EDIÇÃO" />
        <div style={{ borderTop: '1px solid #3C3C3C' }}>
          <Row
            label="Salvamento automático de rascunhos"
            sub="A cada alteração significativa"
            action="toggle"
          />
          <Row
            label="Histórico ilimitado de desfazer"
            sub="Preservado entre sessões até excluir o projeto"
            action="toggle"
          />
          <Row label="Qualidade da pré-visualização" value="Alta" action="arrow" />
        </div>

        {/* PRIVACIDADE */}
        <SectionHeader label="PRIVACIDADE" />
        <div style={{ borderTop: '1px solid #3C3C3C' }}>
          <Row
            label="Processar IA no dispositivo"
            sub="Detecção facial e correções não saem do aparelho"
            action="toggle"
          />
          <Row
            label="Assinar edições publicadas"
            sub="Adiciona nome e data verificáveis, não removíveis"
            action="toggle"
          />
        </div>

        {/* SOBRE */}
        <SectionHeader label="SOBRE" />
        <div style={{ borderTop: '1px solid #3C3C3C' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              minHeight: 56,
              padding: '0 16px',
              borderBottom: '1px solid #3C3C3C',
            }}
          >
            <span style={{ flex: 1, fontSize: 14, color: '#E4E4E4' }}>Versão</span>
            <span style={{ ...M, fontSize: 13, color: '#8E8E8E' }}>2.4.1</span>
          </div>
          <Row label="Termos de uso" action="arrow" />
          <Row label="Política de privacidade" action="arrow" />
          <div style={{ padding: '16px 16px 24px' }}>
            <button
              style={{
                width: '100%',
                height: 44,
                background: 'none',
                border: '1px solid #D25252',
                color: '#D25252',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
