import { useState } from 'react';
import { Menu, Search, ArrowUpDown, Plus, Info, X, Play, Check } from 'lucide-react';

interface Props {
  onHamburguer: () => void;
  onAbrirCamera: () => void;
  onAbrirEditorFoto: (projeto: string) => void;
  onAbrirEditorVideo: (projeto: string) => void;
}

type Aba = 'TODOS' | 'FOTOS' | 'VÍDEOS' | 'RASCUNHOS';

const projetos = [
  {
    id: 1,
    nome: 'Ensaio Praia 04',
    tipo: 'RAW',
    data: '12 set',
    thumb: 'photo-1507525428034-b723cf961d3e',
    video: false,
    rascunho: false,
  },
  {
    id: 2,
    nome: 'Viagem Litoral',
    tipo: 'MP4 4K',
    data: '10 set',
    thumb: 'photo-1469474968028-56623f02e42e',
    video: true,
    dur: '03:42',
    rascunho: false,
  },
  {
    id: 3,
    nome: 'Retrato Marina',
    tipo: 'PSD',
    data: '8 set',
    thumb: 'photo-1531746020798-e6953c6e8e04',
    video: false,
    rascunho: false,
  },
  {
    id: 4,
    nome: 'Feira do Centro',
    tipo: 'JPEG',
    data: '5 set',
    thumb: 'photo-1558618666-fcd25c85cd64',
    video: false,
    rascunho: true,
  },
  {
    id: 5,
    nome: 'Trilha Serra',
    tipo: 'MOV',
    data: '2 set',
    thumb: 'photo-1504701954957-2010ec3bcec1',
    video: true,
    dur: '12:18',
    rascunho: true,
  },
  {
    id: 6,
    nome: 'Logo Cliente',
    tipo: 'PNG',
    data: '30 ago',
    thumb: 'photo-1611532736597-de2d4265fba3',
    video: false,
    rascunho: false,
  },
];

const propriedades = {
  PROPRIEDADES: [
    ['Dimensões', '6000 × 4000'],
    ['Tamanho', '24,3 MB'],
    ['Formato', 'RAW (ARW)'],
    ['Espaço de cor', 'Adobe RGB'],
    ['Taxa de bits', '14 bits'],
    ['Codificação', 'Não comprimido'],
    ['ISO', '100'],
    ['Abertura', 'f/2.8'],
    ['Data', '12 set 2026 · 16:42'],
  ],
  HISTÓRICO: [
    ['16:42', 'Arquivo importado'],
    ['16:43', 'Ajuste de exposição +0,3'],
    ['16:44', 'Curva em S aplicada'],
    ['16:46', 'Máscara de céu criada'],
    ['16:50', 'Redução de ruído (IA)'],
    ['17:02', 'Exportado como JPEG'],
  ],
};

export default function Projetos({
  onHamburguer,
  onAbrirCamera,
  onAbrirEditorFoto,
  onAbrirEditorVideo,
}: Props) {
  const [aba, setAba] = useState<Aba>('TODOS');
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [folhaAberta, setFolhaAberta] = useState<number | null>(null);
  const [abaFolha, setAbaFolha] = useState<'PROPRIEDADES' | 'HISTÓRICO'>('PROPRIEDADES');
  const [aplicandoLote, setAplicandoLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState(0);
  const [presetSelecionado, setPresetSelecionado] = useState('');

  const filtrados = projetos.filter((p) => {
    if (aba === 'FOTOS') return !p.video;
    if (aba === 'VÍDEOS') return p.video;
    if (aba === 'RASCUNHOS') return p.rascunho;
    return true;
  });

  const toggleSelecao = (id: number) => {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const handleLongPress = (id: number) => {
    setModoSelecao(true);
    setSelecionados([id]);
  };

  const aplicarLote = () => {
    setAplicandoLote(true);
    setProgressoLote(0);
    const t = setInterval(() => {
      setProgressoLote((p) => {
        if (p >= 100) {
          clearInterval(t);
          setTimeout(() => {
            setAplicandoLote(false);
            setModoSelecao(false);
            setSelecionados([]);
          }, 400);
          return 100;
        }
        return p + 5;
      });
    }, 80);
  };

  const abrir = (p: (typeof projetos)[0]) => {
    if (modoSelecao) {
      toggleSelecao(p.id);
      return;
    }
    if (p.video) onAbrirEditorVideo(p.nome);
    else onAbrirEditorFoto(p.nome);
  };

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
      {/* Barra superior contextual no modo seleção */}
      {modoSelecao ? (
        <div
          style={{
            height: 48,
            background: '#252525',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 12,
            borderBottom: '1px solid #3C3C3C',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => {
              setModoSelecao(false);
              setSelecionados([]);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} color="#B0B0B0" />
          </button>
          <span style={{ color: '#E4E4E4', fontSize: 15, fontWeight: 500, flex: 1 }}>
            {selecionados.length} selecionado{selecionados.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setSelecionados(filtrados.map((p) => p.id))}
            style={{
              background: 'none',
              border: 'none',
              color: '#3A8FDE',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Todos
          </button>
        </div>
      ) : (
        <div
          style={{
            height: 48,
            background: '#252525',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 12,
            borderBottom: '1px solid #3C3C3C',
            flexShrink: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        >
          <button
            onClick={onHamburguer}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <Menu size={22} color="#B0B0B0" />
          </button>
          <span style={{ color: '#E4E4E4', fontSize: 16, fontWeight: 500, flex: 1 }}>Projetos</span>
          <Search size={20} color="#B0B0B0" strokeWidth={2} style={{ cursor: 'pointer' }} />
          <ArrowUpDown size={20} color="#B0B0B0" strokeWidth={2} style={{ cursor: 'pointer' }} />
        </div>
      )}

      {/* Abas */}
      <div
        style={{
          display: 'flex',
          background: '#252525',
          borderBottom: '1px solid #3C3C3C',
          flexShrink: 0,
        }}
      >
        {(['TODOS', 'FOTOS', 'VÍDEOS', 'RASCUNHOS'] as Aba[]).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: aba === a ? '2px solid #3A8FDE' : '2px solid transparent',
              color: aba === a ? '#3A8FDE' : '#8E8E8E',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: 0.5,
              padding: '10px 4px',
              cursor: 'pointer',
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Corpo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {/* Cartão de lembrete */}
        {(aba === 'TODOS' || aba === 'RASCUNHOS') && (
          <div
            style={{
              display: 'flex',
              background: '#2F2F2F',
              border: '1px solid #3C3C3C',
              marginBottom: 12,
              overflow: 'hidden',
            }}
          >
            <div style={{ width: 4, background: '#D2A05E', flexShrink: 0 }} />
            <div style={{ padding: '10px 12px', flex: 1 }}>
              <div style={{ color: '#E4E4E4', fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                3 projetos pendentes
              </div>
              <div style={{ color: '#8E8E8E', fontSize: 12 }}>
                Ensaio Praia vence em 2 dias · Prioridade alta
              </div>
            </div>
          </div>
        )}

        {/* Grade 2 colunas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {filtrados.map((p) => {
            const sel = selecionados.includes(p.id);
            return (
              <div
                key={p.id}
                onClick={() => abrir(p)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleLongPress(p.id);
                }}
                style={{
                  background: '#2F2F2F',
                  border: '1px solid',
                  borderColor: sel ? '#3A8FDE' : '#3C3C3C',
                  cursor: 'pointer',
                  position: 'relative',
                  outline: sel ? '1px solid #3A8FDE' : 'none',
                }}
              >
                {/* Miniatura */}
                <div style={{ position: 'relative', aspectRatio: '1' }}>
                  <img
                    src={`https://images.unsplash.com/${p.thumb}?w=200&h=200&fit=crop&auto=format`}
                    alt={p.nome}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {p.video && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          background: 'rgba(0,0,0,0.5)',
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Play size={16} color="#fff" fill="#fff" />
                      </div>
                    </div>
                  )}
                  {p.video && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        background: 'rgba(0,0,0,0.7)',
                        padding: '1px 4px',
                      }}
                    >
                      <span className="mono" style={{ color: '#E4E4E4', fontSize: 10 }}>
                        {p.dur}
                      </span>
                    </div>
                  )}
                  {/* Info icon */}
                  {!modoSelecao && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolhaAberta(p.id);
                        setAbaFolha('PROPRIEDADES');
                      }}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'rgba(0,0,0,0.5)',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 3,
                        display: 'flex',
                      }}
                    >
                      <Info size={14} color="#E4E4E4" />
                    </button>
                  )}
                  {/* Seleção */}
                  {modoSelecao && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 20,
                        height: 20,
                        background: sel ? '#3A8FDE' : 'rgba(0,0,0,0.4)',
                        border: '2px solid',
                        borderColor: sel ? '#3A8FDE' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {sel && <Check size={12} color="#fff" />}
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{ padding: '8px 8px 6px' }}>
                  <div
                    style={{
                      color: '#E4E4E4',
                      fontSize: 12,
                      fontWeight: 500,
                      marginBottom: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.nome}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8E8E8E', fontSize: 10 }}>{p.data}</span>
                    <span className="mono" style={{ color: '#8E8E8E', fontSize: 10 }}>
                      {p.tipo}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAB */}
      {!modoSelecao && (
        <button
          onClick={onAbrirCamera}
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            width: 52,
            height: 52,
            background: '#3A8FDE',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <Plus size={24} color="#fff" />
        </button>
      )}

      {/* Folha de aplicação em lote */}
      {modoSelecao && selecionados.length > 0 && (
        <div
          style={{
            background: '#252525',
            borderTop: '1px solid #3C3C3C',
            padding: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>
            APLICAR EM LOTE
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {['Vintage', 'P&B', 'Frio', 'Cine', 'Verão'].map((preset) => (
              <button
                key={preset}
                onClick={() => setPresetSelecionado(preset)}
                style={{
                  background: presetSelecionado === preset ? '#3A8FDE' : 'transparent',
                  border: '1px solid',
                  borderColor: presetSelecionado === preset ? '#3A8FDE' : '#3C3C3C',
                  color: presetSelecionado === preset ? '#fff' : '#E4E4E4',
                  fontSize: 12,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                {preset}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {['Exposição', 'Contraste', 'Saturação', 'Nitidez'].map((aj) => (
              <label
                key={aj}
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
              >
                <input type="checkbox" style={{ accentColor: '#3A8FDE' }} />
                <span style={{ color: '#E4E4E4', fontSize: 11 }}>{aj}</span>
              </label>
            ))}
          </div>
          {aplicandoLote ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#8E8E8E', fontSize: 12 }}>
                  Aplicando em {selecionados.length} itens...
                </span>
                <span className="mono" style={{ color: '#E4E4E4', fontSize: 12 }}>
                  {progressoLote}%
                </span>
              </div>
              <div style={{ height: 2, background: '#3C3C3C' }}>
                <div
                  style={{
                    width: `${progressoLote}%`,
                    height: '100%',
                    background: '#3A8FDE',
                    transition: 'width 0.1s',
                  }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={aplicarLote}
              style={{
                width: '100%',
                background: '#3A8FDE',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                padding: '10px 0',
                cursor: 'pointer',
              }}
            >
              Aplicar em {selecionados.length} item{selecionados.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* Folha de propriedades */}
      {folhaAberta !== null && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setFolhaAberta(null)}
          />
          <div
            style={{
              background: '#252525',
              borderTop: '1px solid #3C3C3C',
              maxHeight: '70%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '1px solid #3C3C3C',
              }}
            >
              <span style={{ color: '#E4E4E4', fontSize: 15, fontWeight: 500, flex: 1 }}>
                {projetos.find((p) => p.id === folhaAberta)?.nome}
              </span>
              <button
                onClick={() => setFolhaAberta(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} color="#8E8E8E" />
              </button>
            </div>
            {/* Abas */}
            <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C' }}>
              {(['PROPRIEDADES', 'HISTÓRICO'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAbaFolha(a)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    borderBottom: abaFolha === a ? '2px solid #3A8FDE' : '2px solid transparent',
                    color: abaFolha === a ? '#3A8FDE' : '#8E8E8E',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: 0.5,
                    padding: '10px 4px',
                    cursor: 'pointer',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
              {propriedades[abaFolha].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #3C3C3C',
                  }}
                >
                  <span style={{ color: '#8E8E8E', fontSize: 12 }}>{k}</span>
                  <span className="mono" style={{ color: '#E4E4E4', fontSize: 12 }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
