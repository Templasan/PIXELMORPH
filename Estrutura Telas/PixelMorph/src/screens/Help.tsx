import { useState } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
  onOpenDrawer: () => void;
}

const faqs = [
  {
    q: 'Como recupero um projeto corrompido?',
    a: 'Abra Armazenamento e toque em Verificar integridade dos projetos. O app restaura a partir do backup automático mais recente.',
  },
  { q: 'Por que meu vídeo 4K trava na linha do tempo?', a: '' },
  { q: 'As edições com IA saem do meu aparelho?', a: '' },
  { q: 'Posso usar meus presets em outro dispositivo?', a: '' },
  { q: 'Como exporto mantendo as camadas?', a: '' },
  { q: 'O que é a assinatura digital nas edições publicadas?', a: '' },
];

const shortcuts = [
  { gesture: 'dois dedos, um toque', action: 'Desfazer' },
  { gesture: 'dois dedos, dois toques', action: 'Refazer' },
  { gesture: 'manter pressionado', action: 'Ver imagem original' },
  { gesture: 'deslizar para cima', action: 'Trocar de ferramenta' },
  { gesture: 'toque duplo', action: 'Aplicar último preset' },
];

const support = [
  { label: 'Reportar um problema', sub: 'Envia os registros locais junto, se você permitir' },
  { label: 'Sugerir uma melhoria', sub: '' },
  { label: 'Falar com o suporte', sub: 'Seg a sex, 9h às 18h' },
];

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ padding: '16px 16px 6px', fontSize: 11, letterSpacing: '0.08em', color: '#8E8E8E' }}>
      {label}
    </div>
  );
}

export default function HelpScreen({ navigate, onOpenDrawer }: Props) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [search, setSearch] = useState('');
  const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1A1A1A' }}>
      {/* Top bar */}
      <div style={{ height: 52, background: '#252525', borderBottom: '1px solid #3C3C3C', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
        <button onClick={onOpenDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Icon name="menu" size={22} color="#B0B0B0" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#E4E4E4' }}>Ajuda</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #3C3C3C' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#2F2F2F', border: '1px solid #3C3C3C', padding: '0 12px', height: 40, gap: 10 }}>
            <Icon name="search" size={16} color="#8E8E8E" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar na ajuda"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: '#E4E4E4',
              }}
            />
          </div>
        </div>

        {/* Tutorial promo card */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #3C3C3C' }}>
          <div style={{ background: '#2F2F2F', borderLeft: '3px solid #3A8FDE', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px' }}>
            <Icon name="bookOpen" size={20} color="#3A8FDE" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: '#E4E4E4', marginBottom: 4 }}>Prefere aprender fazendo?</div>
              <div style={{ fontSize: 12, color: '#8E8E8E', marginBottom: 10 }}>
                Cinco tutoriais interativos com projetos de exemplo
              </div>
              <button
                onClick={() => navigate('tutorials')}
                style={{ fontSize: 13, color: '#3A8FDE', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                Abrir tutoriais
              </button>
            </div>
          </div>
        </div>

        {/* FAQ accordion */}
        <SectionHeader label="PERGUNTAS FREQUENTES" />
        <div style={{ borderTop: '1px solid #3C3C3C' }}>
          {faqs.map((item, i) => (
            <div key={i} style={{ borderBottom: '1px solid #3C3C3C' }}>
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 14, color: '#E4E4E4', flex: 1 }}>{item.q}</span>
                <Icon name={expanded === i ? 'chevronUp' : 'chevronDown'} size={16} color="#8E8E8E" />
              </button>
              {expanded === i && item.a && (
                <div style={{ padding: '0 16px 14px', fontSize: 13, color: '#8E8E8E', lineHeight: 1.55 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Shortcuts */}
        <SectionHeader label="ATALHOS RÁPIDOS" />
        <div style={{ borderTop: '1px solid #3C3C3C' }}>
          {shortcuts.map(s => (
            <div
              key={s.gesture}
              style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #3C3C3C', gap: 16 }}
            >
              <span style={{ ...M, fontSize: 12, color: '#8E8E8E', flex: 1 }}>{s.gesture}</span>
              <span style={{ fontSize: 13, color: '#E4E4E4' }}>{s.action}</span>
            </div>
          ))}
        </div>

        {/* Support */}
        <SectionHeader label="SUPORTE" />
        <div style={{ borderTop: '1px solid #3C3C3C' }}>
          {support.map(item => (
            <button
              key={item.label}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                minHeight: 56,
                padding: item.sub ? '10px 16px' : '0 16px',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid #3C3C3C',
                cursor: 'pointer',
                textAlign: 'left',
                gap: 0,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#E4E4E4' }}>{item.label}</div>
                {item.sub && <div style={{ fontSize: 11, color: '#8E8E8E', marginTop: 2 }}>{item.sub}</div>}
              </div>
              <Icon name="chevronRight" size={16} color="#3C3C3C" />
            </button>
          ))}
        </div>

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
