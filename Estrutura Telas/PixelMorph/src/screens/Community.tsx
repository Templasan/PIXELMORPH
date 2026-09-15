import { useState } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
  onOpenDrawer: () => void;
}

const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

function StarRating({ rating, size = 13, prefix = 'sr' }: { rating: number; size?: number; prefix?: string }) {
  const gap = 2;
  const total = size * 5 + gap * 4;
  const pts = (s: number) => {
    const c = s / 2, r = s / 2;
    const pts: string[] = [];
    for (let i = 0; i < 5; i++) {
      const outer = (i * 2 * Math.PI / 5) - Math.PI / 2;
      const inner = outer + Math.PI / 5;
      pts.push(`${c + r * Math.cos(outer)},${c + r * Math.sin(outer)}`);
      pts.push(`${c + r * 0.4 * Math.cos(inner)},${c + r * 0.4 * Math.sin(inner)}`);
    }
    return pts.join(' ');
  };
  return (
    <svg width={total} height={size} viewBox={`0 0 ${total} ${size}`} style={{ display: 'block' }}>
      <defs>
        {Array.from({ length: 5 }).map((_, i) => {
          const fill = Math.max(0, Math.min(1, rating - i));
          return (
            <clipPath key={i} id={`${prefix}-${i}`}>
              <rect x={0} y={0} width={size * fill} height={size} />
            </clipPath>
          );
        })}
      </defs>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        const x = i * (size + gap);
        return (
          <g key={i} transform={`translate(${x},0)`}>
            <polygon points={pts(size)} fill="#2A2A2A" stroke="#3C3C3C" strokeWidth={0.5} />
            <polygon points={pts(size)} fill="#3A8FDE" clipPath={`url(#${prefix}-${i})`} />
          </g>
        );
      })}
    </svg>
  );
}

const posts = [
  {
    id: 1,
    author: 'Marina Costa',
    initials: 'MC',
    title: 'Ensaio dourado — Praia do Rosa',
    img: 'photo-1507525428034-b723cf961d3e',
    meta: 'Sony A7IV · f/1.8 · ISO 400',
    rating: 4.6,
    comments: 12,
    audioNotes: 3,
    mainComment: 'O céu ficou ótimo, mas a pele puxou muito para o magenta nas sombras — talvez um ajuste seletivo em laranja resolva.',
  },
  {
    id: 2,
    author: 'Rafael Duarte',
    initials: 'RD',
    title: 'Retrato urbano — São Paulo',
    img: 'photo-1531746020798-e6953c6e8e04',
    meta: 'Canon R5 · f/2.8 · ISO 800',
    rating: 4.2,
    comments: 8,
    audioNotes: 1,
    mainComment: 'Nitidez dos olhos perfeita, mas o bokeh de fundo tem aberração cromática verde nas bordas — tenta a correção de lente automática.',
  },
  {
    id: 3,
    author: 'Camila Alves',
    initials: 'CA',
    title: 'Estrada costeira ao entardecer',
    img: 'photo-1504700610630-ac6aba3536d3',
    meta: 'Nikon Z6II · f/8 · ISO 100',
    rating: 4.8,
    comments: 24,
    audioNotes: 5,
    mainComment: 'Composição impecável. Aplicaria um leve curve crush nas sombras para dar mais caráter cinematográfico ao tons laranja.',
  },
];

const TABS = ['EM ALTA', 'RECENTES', 'MINHAS EDIÇÕES', 'REVISÕES'];

export default function CommunityScreen({ navigate, onOpenDrawer }: Props) {
  const [activeTab, setActiveTab] = useState('EM ALTA');
  const [selectedPost, setSelectedPost] = useState<typeof posts[0] | null>(null);
  const [postTab, setPostTab] = useState('COMENTÁRIOS');
  const [comment, setComment] = useState('');

  if (selectedPost) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1A1A1A' }}>
        <div style={{ height: 48, background: '#252525', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, borderBottom: '1px solid #3C3C3C', flexShrink: 0 }}>
          <button onClick={() => setSelectedPost(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icon name="chevronLeft" size={20} color="#B0B0B0" />
          </button>
          <span style={{ flex: 1, fontSize: 13, color: '#E4E4E4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedPost.title}
          </span>
          <Icon name="share" size={18} color="#B0B0B0" />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <img
            src={`https://images.unsplash.com/${selectedPost.img}?w=390&h=260&fit=crop&auto=format`}
            alt={selectedPost.title}
            style={{ width: '100%', display: 'block' }}
          />

          {/* Verified badge */}
          <div style={{ margin: '12px 12px 0', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid rgba(95,185,143,0.35)', background: 'rgba(95,185,143,0.08)' }}>
            <Icon name="shield" size={14} color="#5FB98F" />
            <span style={{ fontSize: 11, color: '#5FB98F' }}>{selectedPost.author}</span>
            <span style={{ fontSize: 11, color: '#8E8E8E' }}>· Assinatura verificada · {new Date().toLocaleDateString('pt-BR')}</span>
          </div>

          {/* Rating */}
          <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <StarRating rating={selectedPost.rating} size={16} prefix={`detail-${selectedPost.id}`} />
            <span style={{ ...M, fontSize: 14, color: '#E4E4E4' }}>{selectedPost.rating}</span>
            <span style={{ fontSize: 12, color: '#8E8E8E' }}>({selectedPost.comments + selectedPost.audioNotes} avaliações)</span>
          </div>

          {/* Post tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C' }}>
            {['COMENTÁRIOS', 'ÁUDIO', 'AJUSTES USADOS'].map(t => (
              <button
                key={t}
                onClick={() => setPostTab(t)}
                style={{
                  padding: '8px 12px',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase' as const,
                  color: postTab === t ? '#3A8FDE' : '#8E8E8E',
                  background: 'none',
                  border: 'none',
                  borderBottom: postTab === t ? '2px solid #3A8FDE' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {postTab === 'COMENTÁRIOS' && (
            <div>
              {[
                { author: selectedPost.author.split(' ')[0], initials: selectedPost.initials, text: selectedPost.mainComment, time: '2h' },
                { author: 'Camila Alves', initials: 'CA', text: 'Cor de pele ótima, mas o realce nas altas luzes perdeu textura nos brancos.', time: '5h' },
                { author: 'Pedro Lima', initials: 'PL', text: 'Exposição muito bem balanceada para a luz dura do pôr do sol.', time: '8h' },
              ].map(c => (
                <div key={c.author + c.time} style={{ display: 'flex', gap: 10, padding: '12px 12px', borderBottom: '1px solid #3C3C3C' }}>
                  <div style={{ width: 32, height: 32, background: 'rgba(58,143,222,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#3A8FDE', flexShrink: 0 }}>{c.initials}</div>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: '#E4E4E4', fontWeight: 500 }}>{c.author}</span>
                      <span style={{ ...M, fontSize: 10, color: '#8E8E8E' }}>{c.time}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#8E8E8E', margin: 0, lineHeight: 1.5 }}>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {postTab === 'ÁUDIO' && (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: selectedPost.audioNotes }).map((_, i) => (
                <div key={i} style={{ background: '#2F2F2F', border: '1px solid #3C3C3C', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
                  <button style={{ width: 32, height: 32, border: '1px solid #3A8FDE', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', cursor: 'pointer' }}>
                    <Icon name="play" size={14} color="#3A8FDE" />
                  </button>
                  <div style={{ flex: 1, height: 28, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                    {Array.from({ length: 36 }).map((_, j) => (
                      <div key={j} style={{ flex: 1, background: '#3A8FDE', opacity: 0.55, height: `${25 + Math.sin(j * 0.6 + i) * 65}%` }} />
                    ))}
                  </div>
                  <span style={{ ...M, fontSize: 10, color: '#8E8E8E', flexShrink: 0 }}>0:{String(14 + i * 8).padStart(2, '0')}</span>
                </div>
              ))}
            </div>
          )}

          {postTab === 'AJUSTES USADOS' && (
            <div>
              {[
                ['Temperatura', '+200 K'],
                ['Saturação', '+25'],
                ['Exposição', '+0,3 EV'],
                ['Contraste', '+15'],
                ['Nitidez', '+30'],
                ['Redução ruído', '+20'],
                ['Curvas', 'Curva S leve'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #3C3C3C' }}>
                  <span style={{ fontSize: 12, color: '#8E8E8E' }}>{k}</span>
                  <span style={{ ...M, fontSize: 12, color: '#E4E4E4' }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comment input */}
        <div style={{ background: '#252525', borderTop: '1px solid #3C3C3C', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexShrink: 0 }}>
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Adicionar comentário..."
            style={{ flex: 1, background: '#2F2F2F', border: '1px solid #3C3C3C', padding: '7px 10px', fontSize: 12, color: '#E4E4E4', outline: 'none', borderRadius: 0 }}
          />
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Icon name="mic" size={20} color="#B0B0B0" />
          </button>
          <button
            style={{ padding: '6px 10px', background: comment ? '#3A8FDE' : 'transparent', border: `1px solid ${comment ? '#3A8FDE' : '#3C3C3C'}`, fontSize: 12, color: comment ? '#0D0D0D' : '#8E8E8E', cursor: 'pointer' }}
          >
            <Icon name="share" size={14} color={comment ? '#0D0D0D' : '#8E8E8E'} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1A1A1A' }}>
      {/* Top bar */}
      <div style={{ height: 56, background: '#252525', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, borderBottom: '1px solid #3C3C3C', boxShadow: '0 1px 4px rgba(0,0,0,0.5)', flexShrink: 0 }}>
        <button onClick={onOpenDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Icon name="menu" size={22} color="#B0B0B0" />
        </button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 500, color: '#E4E4E4' }}>Comunidade</span>
        <Icon name="search" size={20} color="#B0B0B0" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#252525', borderBottom: '1px solid #3C3C3C', overflowX: 'auto', flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '10px 14px',
              fontSize: 11,
              letterSpacing: '0.06em',
              color: activeTab === t ? '#3A8FDE' : '#8E8E8E',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t ? '2px solid #3A8FDE' : '2px solid transparent',
              cursor: 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {posts.map(post => (
          <div
            key={post.id}
            style={{ borderBottom: '1px solid #3C3C3C', cursor: 'pointer' }}
            onClick={() => { setSelectedPost(post); setPostTab('Comentários'); }}
          >
            {/* Author row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 8px' }}>
              <div style={{ width: 34, height: 34, background: 'rgba(58,143,222,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#3A8FDE', flexShrink: 0 }}>{post.initials}</div>
              <div>
                <div style={{ fontSize: 13, color: '#E4E4E4', fontWeight: 500 }}>{post.author}</div>
                <div style={{ ...M, fontSize: 10, color: '#8E8E8E' }}>{post.meta}</div>
              </div>
              <button style={{ marginLeft: 'auto', padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
                <Icon name="info" size={16} color="#8E8E8E" />
              </button>
            </div>
            {/* Image */}
            <img
              src={`https://images.unsplash.com/${post.img}?w=390&h=220&fit=crop&auto=format`}
              alt={post.title}
              style={{ width: '100%', display: 'block' }}
            />
            {/* Stats */}
            <div style={{ padding: '8px 12px 12px' }}>
              <div style={{ fontSize: 14, color: '#E4E4E4', fontWeight: 500, marginBottom: 6 }}>{post.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <StarRating rating={post.rating} size={12} prefix={`post-${post.id}`} />
                  <span style={{ ...M, fontSize: 11, color: '#8E8E8E' }}>{post.rating}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="messageCircle" size={14} color="#8E8E8E" />
                  <span style={{ fontSize: 11, color: '#8E8E8E' }}>{post.comments}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="mic" size={14} color="#8E8E8E" />
                  <span style={{ fontSize: 11, color: '#8E8E8E' }}>{post.audioNotes}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div style={{ height: 80 }} />
      </div>

      {/* FAB extended */}
      <button
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          background: '#3A8FDE',
          borderRadius: 24,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}
      >
        <Icon name="upload" size={18} color="#fff" />
        <span style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>Enviar edição</span>
      </button>
    </div>
  );
}
