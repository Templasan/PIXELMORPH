import { useState, useRef } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
  onOpenDrawer: () => void;
}

const projects = [
  { id: 1, name: 'Ensaio Praia 04', type: 'RAW', date: '12/09/2026', img: 'photo-1507525428034-b723cf961d3e', isVideo: false },
  { id: 2, name: 'Viagem Litoral', type: 'MP4 · 4K', date: '10/09/2026', img: 'photo-1504700610630-ac6aba3536d3', isVideo: true, duration: '2:34' },
  { id: 3, name: 'Retrato Marina', type: 'PSD', date: '08/09/2026', img: 'photo-1531746020798-e6953c6e8e04', isVideo: false },
  { id: 4, name: 'Feira do Centro', type: 'JPEG', date: '05/09/2026', img: 'photo-1555396273-367ea4eb4db5', isVideo: false },
  { id: 5, name: 'Trilha Serra', type: 'MOV', date: '03/09/2026', img: 'photo-1510797215324-95aa89f43c33', isVideo: true, duration: '5:12' },
  { id: 6, name: 'Logo Cliente', type: 'PNG', date: '01/09/2026', img: 'photo-1558618666-fcd25c85cd64', isVideo: false },
];

const TABS = ['TODOS', 'FOTOS', 'VÍDEOS', 'RASCUNHOS'];

export default function ProjectsScreen({ navigate, onOpenDrawer }: Props) {
  const [activeTab, setActiveTab] = useState('TODOS');
  const [selected, setSelected] = useState<number[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [infoProject, setInfoProject] = useState<typeof projects[0] | null>(null);
  const [infoTab, setInfoTab] = useState('PROPRIEDADES');
  const [batchProgress, setBatchProgress] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = projects.filter(p => {
    if (activeTab === 'FOTOS') return !p.isVideo;
    if (activeTab === 'VÍDEOS') return p.isVideo;
    if (activeTab === 'RASCUNHOS') return ['PSD', 'PNG'].includes(p.type);
    return true;
  });

  const toggleSelect = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const startLongPress = (id: number) => {
    longPressTimer.current = setTimeout(() => {
      setMultiSelect(true);
      setSelected([id]);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const exitMultiSelect = () => {
    setMultiSelect(false);
    setSelected([]);
  };

  const applyBatch = () => {
    setBatchProgress(0);
    const iv = setInterval(() => {
      setBatchProgress(prev => {
        if (prev === null || prev >= 100) { clearInterval(iv); setBatchProgress(null); exitMultiSelect(); return null; }
        return prev + 12;
      });
    }, 150);
  };

  const S: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1A1A1A' }}>
      {/* Top bar */}
      {multiSelect ? (
        <div style={{ height: 56, background: '#252525', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, borderBottom: '1px solid #3C3C3C' }}>
          <button onClick={exitMultiSelect} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icon name="x" size={22} color="#B0B0B0" />
          </button>
          <span style={{ flex: 1, fontSize: 14, color: '#E4E4E4' }}>{selected.length} selecionados</span>
          <Icon name="share" size={20} color="#B0B0B0" />
          <Icon name="upload" size={20} color="#B0B0B0" />
        </div>
      ) : (
        <div style={{ height: 56, background: '#252525', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, borderBottom: '1px solid #3C3C3C', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
          <button onClick={onOpenDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icon name="menu" size={22} color="#B0B0B0" />
          </button>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 500, color: '#E4E4E4' }}>Projetos</span>
          <Icon name="search" size={20} color="#B0B0B0" />
          <Icon name="sort" size={20} color="#B0B0B0" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#252525', borderBottom: '1px solid #3C3C3C' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 11,
              letterSpacing: '0.06em',
              color: activeTab === t ? '#3A8FDE' : '#8E8E8E',
              border: 'none',
              borderBottom: activeTab === t ? '2px solid #3A8FDE' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Reminder card */}
      <div style={{ margin: '12px 12px 4px', background: '#2F2F2F', display: 'flex' }}>
        <div style={{ width: 4, background: '#D2A05E', flexShrink: 0 }} />
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 12, color: '#E4E4E4', fontWeight: 500 }}>3 projetos pendentes</div>
          <div style={{ fontSize: 11, color: '#8E8E8E', marginTop: 2 }}>Ensaio Praia vence em 2 dias · Prioridade alta</div>
        </div>
      </div>

      {/* Project grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {filtered.map(project => (
            <div
              key={project.id}
              style={{
                background: '#2F2F2F',
                border: `1px solid ${selected.includes(project.id) ? '#3A8FDE' : '#3C3C3C'}`,
                cursor: 'pointer',
              }}
              onMouseDown={() => !multiSelect && startLongPress(project.id)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={() => !multiSelect && startLongPress(project.id)}
              onTouchEnd={cancelLongPress}
              onClick={() => {
                if (multiSelect) {
                  toggleSelect(project.id);
                } else {
                  navigate(project.isVideo ? 'videoEditor' : 'photoEditor');
                }
              }}
            >
              {/* Thumbnail */}
              <div style={{ aspectRatio: '1', position: 'relative', overflow: 'hidden', background: '#1F1F1F' }}>
                <img
                  src={`https://images.unsplash.com/${project.img}?w=200&h=200&fit=crop&auto=format`}
                  alt={project.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {project.isVideo && (
                  <>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 32, height: 32, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="play" size={16} color="#E4E4E4" />
                      </div>
                    </div>
                    <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.7)', padding: '1px 4px' }}>
                      <span style={{ ...S, fontSize: 10, color: '#E4E4E4' }}>{project.duration}</span>
                    </div>
                  </>
                )}
                {multiSelect && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 20,
                      height: 20,
                      border: `1px solid ${selected.includes(project.id) ? '#3A8FDE' : '#E4E4E4'}`,
                      background: selected.includes(project.id) ? '#3A8FDE' : 'rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected.includes(project.id) && <Icon name="check" size={12} color="#000" />}
                  </div>
                )}
              </div>
              {/* Info row */}
              <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#E4E4E4', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
                    {project.name}
                  </div>
                  <div style={{ ...S, fontSize: 10, color: '#8E8E8E', marginTop: 2 }}>
                    {project.date} · {project.type}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setInfoProject(project); setInfoTab('PROPRIEDADES'); }}
                  style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                >
                  <Icon name="info" size={14} color="#8E8E8E" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAB */}
      {!multiSelect && (
        <button
          onClick={() => navigate('camera')}
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            width: 56,
            height: 56,
            background: '#3A8FDE',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <Icon name="camera" size={24} color="#fff" />
        </button>
      )}

      {/* Batch apply bottom sheet */}
      {multiSelect && selected.length > 0 && (
        <div style={{ background: '#252525', borderTop: '1px solid #3C3C3C', padding: '12px 16px' }}>
          <div style={{ fontSize: 10, color: '#8E8E8E', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Aplicar em lote</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {['P&B', 'Vívido', 'Sépia', 'Frio', 'Cine'].map(p => (
              <div key={p} style={{ padding: '4px 10px', border: '1px solid #3C3C3C', fontSize: 11, color: '#E4E4E4', cursor: 'pointer' }}>{p}</div>
            ))}
          </div>
          {batchProgress !== null ? (
            <div>
              <div style={{ height: 2, background: '#3C3C3C', marginBottom: 4 }}>
                <div style={{ width: `${batchProgress}%`, height: '100%', background: '#3A8FDE', transition: 'width 0.15s' }} />
              </div>
              <span style={{ ...S, fontSize: 11, color: '#8E8E8E' }}>{batchProgress}%</span>
            </div>
          ) : (
            <button
              onClick={applyBatch}
              style={{ width: '100%', height: 36, background: '#3A8FDE', color: '#0D0D0D', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', border: 'none', cursor: 'pointer', borderRadius: 0 }}
            >
              Aplicar em {selected.length} {selected.length === 1 ? 'item' : 'itens'}
            </button>
          )}
        </div>
      )}

      {/* Info sheet */}
      {infoProject && (
        <div style={{ position: 'absolute', inset: '0 0 0 0', top: '40%', background: '#252525', borderTop: '1px solid #3C3C3C', zIndex: 30, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 48, borderBottom: '1px solid #3C3C3C' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {['PROPRIEDADES', 'HISTÓRICO'].map(t => (
                <button
                  key={t}
                  onClick={() => setInfoTab(t)}
                  style={{ fontSize: 11, letterSpacing: '0.06em', color: infoTab === t ? '#3A8FDE' : '#8E8E8E', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => setInfoProject(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Icon name="x" size={18} color="#B0B0B0" />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {infoTab === 'PROPRIEDADES' ? (
              <div>
                {[['Nome', infoProject.name], ['Tipo', infoProject.type], ['Dimensões', '6000 × 4000'], ['Tamanho', '42,3 MB'], ['Espaço de cor', 'Adobe RGB'], ['Taxa de bits', '24 bits'], ['Codificação', 'JPEG Baseline'], ['ISO', '400'], ['Abertura', 'f/2.8'], ['Data', infoProject.date]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #3C3C3C' }}>
                    <span style={{ fontSize: 12, color: '#8E8E8E' }}>{k}</span>
                    <span style={{ ...S, fontSize: 12, color: '#E4E4E4' }}>{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {[['14:32', 'Ajuste de curvas aplicado'], ['14:15', 'Saturação +20'], ['13:58', 'Recorte 16:9'], ['13:40', 'Abertura do arquivo']].map(([time, action]) => (
                  <div key={time} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid #3C3C3C' }}>
                    <span style={{ ...S, fontSize: 12, color: '#8E8E8E', width: 40, flexShrink: 0 }}>{time}</span>
                    <span style={{ fontSize: 12, color: '#E4E4E4' }}>{action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
