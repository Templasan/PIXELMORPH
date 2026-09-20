import { useState } from 'react';
import {
  Menu,
  ChevronLeft,
  Star,
  MessageSquare,
  Mic,
  Play,
  Send,
  UserCircle,
  CheckCircle,
} from 'lucide-react';

interface Props {
  onVoltar: () => void;
  onHamburguer: () => void;
}

type Aba = 'EM ALTA' | 'RECENTES' | 'MINHAS EDIÇÕES' | 'REVISÕES';

const publicacoes = [
  {
    id: 1,
    autor: 'Marina Luz',
    avatar: 'ML',
    titulo: 'Pôr do sol — Ensaio final',
    img: 'photo-1507525428034-b723cf961d3e',
    nota: 4.7,
    totalNota: 23,
    comentarios: 8,
    anotacoes: 3,
    meta: 'Nikon Z6 · f/2.8 · 1/800s · ISO 200',
    ajustes: ['Temperatura +15', 'Curva em S', 'Máscara Céu', 'Redução ruído IA'],
  },
  {
    id: 2,
    autor: 'Pedro Costa',
    avatar: 'PC',
    titulo: 'Retrato na golden hour',
    img: 'photo-1531746020798-e6953c6e8e04',
    nota: 4.3,
    totalNota: 11,
    comentarios: 5,
    anotacoes: 1,
    meta: 'Sony A7IV · f/1.8 · 1/1000s · ISO 100',
    ajustes: ['Exposição -0.3', 'Saturação skin', 'Suavização retrato IA'],
  },
  {
    id: 3,
    autor: 'Ana Ferreira',
    avatar: 'AF',
    titulo: 'Estrada costeira ao amanhecer',
    img: 'photo-1469474968028-56623f02e42e',
    nota: 4.9,
    totalNota: 41,
    comentarios: 14,
    anotacoes: 5,
    meta: 'Canon R5 · f/8 · 1/250s · ISO 400',
    ajustes: ['Temperatura -20', 'Contraste +25', 'Remoção névoa IA'],
  },
];

const comentariosBase = [
  {
    autor: 'Rafael M.',
    avatar: 'RM',
    texto: 'O céu ficou ótimo, mas a pele puxou muito para o magenta na sombra.',
  },
  {
    autor: 'Carla S.',
    avatar: 'CS',
    texto: 'A curva em S funcionou bem. Talvez reduzir um pouco a saturação nos laranjas.',
  },
  {
    autor: 'Bruno T.',
    avatar: 'BT',
    texto: 'Excelente uso da máscara de luminosidade. Técnica precisa.',
  },
];

const anotacoesBase = [
  { autor: 'Rafael M.', tempo: '0:12', duracao: '0:08' },
  { autor: 'Carla S.', tempo: '0:34', duracao: '0:15' },
];

const cursores = [
  { nome: 'Marina', cor: '#3A8FDE', x: 45, y: 60 },
  { nome: 'Pedro', cor: '#5FB98F', x: 180, y: 140 },
];

export default function Comunidade({ onVoltar, onHamburguer }: Props) {
  const [aba, setAba] = useState<Aba>('EM ALTA');
  const [publicacaoAberta, setPublicacaoAberta] = useState<(typeof publicacoes)[0] | null>(null);
  const [abaDetalhe, setAbaDetalhe] = useState<'Comentários' | 'Áudio' | 'Ajustes usados'>(
    'Comentários'
  );
  const [modoColab, setModoColab] = useState(false);
  const [notas, setNotas] = useState<Record<number, number>>({});

  const abas: Aba[] = ['EM ALTA', 'RECENTES', 'MINHAS EDIÇÕES', 'REVISÕES'];

  if (publicacaoAberta) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1A1A1A',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Header detalhe */}
        <div
          style={{
            height: 48,
            background: '#252525',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 8,
            borderBottom: '1px solid #3C3C3C',
          }}
        >
          <button
            onClick={() => setPublicacaoAberta(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <ChevronLeft size={22} color="#B0B0B0" />
          </button>
          <span style={{ color: '#E4E4E4', fontSize: 15, fontWeight: 500, flex: 1 }}>
            {publicacaoAberta.titulo}
          </span>
          {modoColab && (
            <div style={{ display: 'flex' }}>
              {cursores.map((c) => (
                <div
                  key={c.nome}
                  style={{
                    width: 24,
                    height: 24,
                    background: c.cor,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: -6,
                    border: '1px solid #252525',
                  }}
                >
                  <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>{c.nome[0]}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setModoColab(!modoColab)}
            style={{
              background: modoColab ? 'rgba(58,143,222,0.2)' : 'transparent',
              border: '1px solid',
              borderColor: modoColab ? '#3A8FDE' : '#3C3C3C',
              color: modoColab ? '#3A8FDE' : '#8E8E8E',
              fontSize: 10,
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            {modoColab ? 'Colab ativo' : 'Colaborar'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Imagem */}
          <div style={{ position: 'relative' }}>
            <img
              src={`https://images.unsplash.com/${publicacaoAberta.img}?w=390&h=260&fit=crop&auto=format`}
              alt={publicacaoAberta.titulo}
              style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }}
            />
            {/* Cursores colaborativos */}
            {modoColab &&
              cursores.map((c) => (
                <div
                  key={c.nome}
                  style={{
                    position: 'absolute',
                    left: c.x,
                    top: c.y,
                    pointerEvents: 'none',
                  }}
                >
                  <svg width={16} height={16} viewBox="0 0 16 16">
                    <path d="M0 0 L0 14 L4 10 L7 16 L9 15 L6 9 L12 9 Z" fill={c.cor} />
                  </svg>
                  <div
                    style={{
                      background: c.cor,
                      padding: '1px 4px',
                      fontSize: 8,
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      marginTop: -2,
                    }}
                  >
                    {c.nome}
                  </div>
                </div>
              ))}
          </div>

          {/* Assinatura digital */}
          <div
            style={{
              background: 'rgba(95,185,143,0.12)',
              border: '1px solid #5FB98F',
              margin: '0 0',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle size={14} color="#5FB98F" />
            <span style={{ color: '#5FB98F', fontSize: 11 }}>
              Assinatura verificada — {publicacaoAberta.autor} · 12 set 2026
            </span>
          </div>

          {/* Conflito colaborativo */}
          {modoColab && (
            <div
              style={{
                margin: '8px 12px',
                background: '#2F2F2F',
                border: '1px solid #D2A05E',
                padding: 10,
              }}
            >
              <div style={{ color: '#D2A05E', fontSize: 11, marginBottom: 8 }}>
                Conflito detectado na camada "Correção de cor"
              </div>
              <div style={{ color: '#8E8E8E', fontSize: 11, marginBottom: 8 }}>
                Marina aplicou ajuste diferente simultaneamente.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  style={{
                    flex: 1,
                    background: '#3A8FDE',
                    border: 'none',
                    color: '#fff',
                    fontSize: 12,
                    padding: '6px 0',
                    cursor: 'pointer',
                  }}
                >
                  Manter minha
                </button>
                <button
                  style={{
                    flex: 1,
                    background: '#2F2F2F',
                    border: '1px solid #3C3C3C',
                    color: '#E4E4E4',
                    fontSize: 12,
                    padding: '6px 0',
                    cursor: 'pointer',
                  }}
                >
                  Usar de Marina
                </button>
              </div>
            </div>
          )}

          {/* Faixa de atividade */}
          {modoColab && (
            <div
              style={{
                background: '#1F1F1F',
                padding: '6px 12px',
                borderTop: '1px solid #3C3C3C',
                borderBottom: '1px solid #3C3C3C',
              }}
            >
              <span style={{ color: '#8E8E8E', fontSize: 11 }}>
                Marina aplicou <span style={{ color: '#3A8FDE' }}>Máscara de céu</span> · agora
              </span>
            </div>
          )}

          {/* Pontuação */}
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #3C3C3C' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="mono" style={{ color: '#E4E4E4', fontSize: 28, fontWeight: 700 }}>
                  {publicacaoAberta.nota}
                </span>
                <span style={{ color: '#8E8E8E', fontSize: 10 }}>
                  {publicacaoAberta.totalNota} avaliações
                </span>
              </div>
              <div style={{ flex: 1 }}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <div
                    key={n}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}
                  >
                    <span style={{ color: '#8E8E8E', fontSize: 9, width: 6 }}>{n}</span>
                    <div style={{ flex: 1, height: 3, background: '#3C3C3C' }}>
                      <div
                        style={{ width: `${(6 - n) * 20}%`, height: '100%', background: '#3A8FDE' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNotas((prev) => ({ ...prev, [publicacaoAberta.id]: n }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1 }}
                  >
                    <Star
                      size={18}
                      color="#3A8FDE"
                      fill={(notas[publicacaoAberta.id] || 0) >= n ? '#3A8FDE' : 'none'}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Abas detalhe */}
          <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C' }}>
            {(['Comentários', 'Áudio', 'Ajustes usados'] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAbaDetalhe(a)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  borderBottom: abaDetalhe === a ? '2px solid #3A8FDE' : '2px solid transparent',
                  color: abaDetalhe === a ? '#3A8FDE' : '#8E8E8E',
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '10px 4px',
                  cursor: 'pointer',
                }}
              >
                {a}
              </button>
            ))}
          </div>

          {/* Conteúdo aba */}
          <div style={{ padding: '8px 12px 80px' }}>
            {abaDetalhe === 'Comentários' &&
              comentariosBase.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      background: '#3A8FDE',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {c.avatar}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: '#8E8E8E', fontSize: 12, fontWeight: 500 }}>
                      {c.autor}
                    </span>
                    <p
                      style={{ color: '#E4E4E4', fontSize: 13, margin: '2px 0 0', lineHeight: 1.5 }}
                    >
                      {c.texto}
                    </p>
                  </div>
                </div>
              ))}

            {abaDetalhe === 'Áudio' &&
              anotacoesBase.map((a, i) => (
                <div
                  key={i}
                  style={{
                    background: '#2F2F2F',
                    border: '1px solid #3C3C3C',
                    padding: '8px 10px',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: '#8E8E8E', fontSize: 12 }}>{a.autor}</span>
                    <span className="mono" style={{ color: '#8E8E8E', fontSize: 10 }}>
                      {a.tempo} · {a.duracao}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      style={{
                        background: '#3A8FDE',
                        border: 'none',
                        width: 28,
                        height: 28,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Play size={14} color="#fff" fill="#fff" />
                    </button>
                    <div
                      style={{
                        flex: 1,
                        height: 28,
                        background: '#1F1F1F',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <svg width="100%" height="28" viewBox="0 0 200 28" preserveAspectRatio="none">
                        <path
                          d={`M0 14 ${Array.from({ length: 50 }, (_, k) => `L${k * 4} ${14 - Math.sin(k * 0.8) * 10}`).join(' ')}`}
                          fill="none"
                          stroke="#5FB98F"
                          strokeWidth={1.5}
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}

            {abaDetalhe === 'Ajustes usados' &&
              publicacaoAberta.ajustes.map((aj, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: '1px solid #3C3C3C',
                  }}
                >
                  <div style={{ width: 4, height: 16, background: '#3A8FDE', flexShrink: 0 }} />
                  <span style={{ color: '#E4E4E4', fontSize: 13 }}>{aj}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Campo de comentário */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#252525',
            borderTop: '1px solid #3C3C3C',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <input
            type="text"
            placeholder="Adicionar comentário..."
            style={{
              flex: 1,
              background: '#2F2F2F',
              border: '1px solid #3C3C3C',
              color: '#E4E4E4',
              fontSize: 13,
              padding: '8px 10px',
              fontFamily: 'Roboto, sans-serif',
            }}
          />
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Mic size={20} color="#B0B0B0" />
          </button>
          <button
            style={{
              background: '#3A8FDE',
              border: 'none',
              width: 36,
              height: 36,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1A1A1A',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Barra superior */}
      <div
        style={{
          height: 48,
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
          onClick={onHamburguer}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <Menu size={22} color="#B0B0B0" />
        </button>
        <span style={{ color: '#E4E4E4', fontSize: 16, fontWeight: 500, flex: 1 }}>Comunidade</span>
      </div>

      {/* Abas */}
      <div
        style={{
          display: 'flex',
          background: '#252525',
          borderBottom: '1px solid #3C3C3C',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {abas.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: aba === a ? '2px solid #3A8FDE' : '2px solid transparent',
              color: aba === a ? '#3A8FDE' : '#8E8E8E',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: 0.3,
              padding: '10px 12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {publicacoes.map((pub) => (
          <div
            key={pub.id}
            onClick={() => setPublicacaoAberta(pub)}
            style={{ borderBottom: '1px solid #3C3C3C', cursor: 'pointer' }}
          >
            {/* Cabeçalho do card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 0' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: '#3A8FDE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                }}
              >
                {pub.avatar}
              </div>
              <div>
                <div style={{ color: '#E4E4E4', fontSize: 13, fontWeight: 500 }}>{pub.autor}</div>
                <div className="mono" style={{ color: '#8E8E8E', fontSize: 10 }}>
                  {pub.meta}
                </div>
              </div>
            </div>
            {/* Imagem */}
            <div style={{ margin: '8px 0' }}>
              <img
                src={`https://images.unsplash.com/${pub.img}?w=390&h=220&fit=crop&auto=format`}
                alt={pub.titulo}
                style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
              />
            </div>
            {/* Info */}
            <div style={{ padding: '0 12px 10px' }}>
              <div style={{ color: '#E4E4E4', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                {pub.titulo}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={13} color="#3A8FDE" fill="#3A8FDE" />
                  <span className="mono" style={{ color: '#E4E4E4', fontSize: 12 }}>
                    {pub.nota}
                  </span>
                  <span style={{ color: '#8E8E8E', fontSize: 11 }}>({pub.totalNota})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MessageSquare size={13} color="#8E8E8E" />
                  <span style={{ color: '#8E8E8E', fontSize: 11 }}>{pub.comentarios}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mic size={13} color="#8E8E8E" />
                  <span style={{ color: '#8E8E8E', fontSize: 11 }}>{pub.anotacoes}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <div style={{ position: 'absolute', bottom: 20, right: 16 }}>
        <button
          style={{
            background: '#3A8FDE',
            border: 'none',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <MessageSquare size={16} color="#fff" />
          Enviar edição
        </button>
      </div>
    </div>
  );
}
