import { useState } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
  onOpenDrawer: () => void;
}

const TABS = ['TRILHAS', 'POR FERRAMENTA', 'CONCLUÍDOS'];

const tutorials = [
  {
    id: 1,
    title: 'Céu dramático',
    steps: 7,
    minutes: 4,
    done: 3,
    img: 'photo-1507525428034-b723cf961d3e',
  },
  {
    id: 2,
    title: 'Remover objeto com IA',
    steps: 5,
    minutes: 3,
    done: 0,
    img: 'photo-1558618666-fcd25c85cd64',
  },
  {
    id: 3,
    title: 'Corrigir perspectiva',
    steps: 4,
    minutes: 2,
    done: 0,
    img: 'photo-1504701954957-2010ec3bcec1',
  },
  {
    id: 4,
    title: 'Montar time-lapse',
    steps: 6,
    minutes: 5,
    done: 2,
    img: 'photo-1469474968028-56623f02e42e',
  },
  {
    id: 5,
    title: 'Máscara de céu em retrato',
    steps: 5,
    minutes: 3,
    done: 0,
    img: 'photo-1531746020798-e6953c6e8e04',
  },
];

const stepDescs = [
  {
    title: 'Abrir projeto',
    text: 'Selecione um projeto na tela de Projetos para começar a edição.',
  },
  {
    title: 'Acessar ajustes',
    text: 'Toque no ícone de sliders na barra inferior para abrir os ajustes.',
  },
  {
    title: 'Abrir as máscaras',
    text: 'Toque em Máscaras para pintar um ajuste apenas no céu desta foto.',
  },
  {
    title: 'Selecionar pincéis',
    text: 'Escolha o tamanho e a dureza do pincel para mascarar a área desejada.',
  },
  {
    title: 'Ajustar temperatura',
    text: 'Arraste o slider de temperatura para deixar o céu mais frio.',
  },
  { title: 'Revisar máscara', text: 'Ative "Mostrar máscara" para verificar as bordas pintadas.' },
  { title: 'Exportar', text: 'Toque em Exportar e escolha o formato e resolução.' },
];

interface TutorialOverlayProps {
  tutorial: (typeof tutorials)[0];
  onClose: () => void;
}

function TutorialOverlay({ tutorial, onClose }: TutorialOverlayProps) {
  const [step, setStep] = useState(tutorial.done > 0 ? tutorial.done - 1 : 0);
  const total = tutorial.steps;
  const desc = stepDescs[step] ?? stepDescs[0];
  const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
      {/* Background: photo editor canvas mockup */}
      <img
        src={`https://images.unsplash.com/${tutorial.img}?w=390&h=844&fit=crop&auto=format`}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {/* Dark veil */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.70)' }} />

      {/* Spotlight circle */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '55%',
          transform: 'translate(-50%, -50%)',
          width: 96,
          height: 96,
          borderRadius: '50%',
          border: '2px solid #3A8FDE',
          boxShadow: '0 0 0 2000px rgba(0,0,0,0.70)',
          zIndex: 1,
        }}
      />

      {/* Balloon */}
      <div
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          top: 160,
          background: '#252525',
          border: '1px solid #3C3C3C',
          zIndex: 2,
          padding: '14px 14px 12px',
        }}
      >
        {/* Arrow pointing down toward spotlight */}
        <div
          style={{
            position: 'absolute',
            bottom: -9,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid #3C3C3C',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -7,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: '7px solid #252525',
          }}
        />

        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <span style={{ ...M, fontSize: 10, color: '#8E8E8E', letterSpacing: '0.08em' }}>
            PASSO {step + 1} DE {total}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Icon name="x" size={16} color="#8E8E8E" />
          </button>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, color: '#E4E4E4', marginBottom: 6 }}>
          {desc.title}
        </div>
        <div style={{ fontSize: 12, color: '#8E8E8E', lineHeight: 1.5, marginBottom: 12 }}>
          {desc.text}
        </div>

        {/* Segmented progress */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                background: i <= step ? '#3A8FDE' : '#3C3C3C',
              }}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={onClose}
            style={{
              fontSize: 11,
              color: '#8E8E8E',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Pular tutorial
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              style={{
                fontSize: 12,
                color: step === 0 ? '#3C3C3C' : '#E4E4E4',
                background: 'none',
                border: '1px solid ' + (step === 0 ? '#3C3C3C' : '#3C3C3C'),
                cursor: step === 0 ? 'default' : 'pointer',
                padding: '5px 14px',
              }}
            >
              Anterior
            </button>
            <button
              onClick={() => {
                if (step < total - 1) setStep((s) => s + 1);
                else onClose();
              }}
              style={{
                fontSize: 12,
                color: '#fff',
                background: '#3A8FDE',
                border: 'none',
                cursor: 'pointer',
                padding: '5px 14px',
              }}
            >
              {step === total - 1 ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TutorialsScreen({ onOpenDrawer }: Props) {
  const [activeTab, setActiveTab] = useState('TRILHAS');
  const [activeTutorial, setActiveTutorial] = useState<(typeof tutorials)[0] | null>(null);
  const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  const list = activeTab === 'CONCLUÍDOS' ? tutorials.filter((t) => t.done === t.steps) : tutorials;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#1A1A1A',
        position: 'relative',
      }}
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
        <span style={{ fontSize: 16, fontWeight: 600, color: '#E4E4E4', flex: 1 }}>Tutoriais</span>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #3C3C3C',
          background: '#252525',
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => (
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

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {list.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTutorial(t)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #3C3C3C',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {/* Thumbnail */}
            <div
              style={{
                flexShrink: 0,
                width: 72,
                height: 56,
                overflow: 'hidden',
                border: '1px solid #3C3C3C',
              }}
            >
              <img
                src={`https://images.unsplash.com/${t.img}?w=72&h=56&fit=crop&auto=format`}
                alt={t.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: '#E4E4E4', marginBottom: 4 }}>{t.title}</div>
              <div
                style={{ ...M, fontSize: 11, color: '#8E8E8E', marginBottom: t.done > 0 ? 8 : 0 }}
              >
                {t.steps} passos · {t.minutes} min
                {t.done === 0 && (
                  <span style={{ marginLeft: 6, color: '#5FB98F' }}>· Não iniciado</span>
                )}
              </div>
              {t.done > 0 && (
                <div>
                  <div style={{ ...M, fontSize: 10, color: '#3A8FDE', marginBottom: 4 }}>
                    {t.done} de {t.steps} concluídos
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {Array.from({ length: t.steps }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: 3,
                          background: i < t.done ? '#3A8FDE' : '#3C3C3C',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Icon name="chevronRight" size={16} color="#3C3C3C" />
          </button>
        ))}
      </div>

      {/* Tutorial overlay */}
      {activeTutorial && (
        <TutorialOverlay tutorial={activeTutorial} onClose={() => setActiveTutorial(null)} />
      )}
    </div>
  );
}
