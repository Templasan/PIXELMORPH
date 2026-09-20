import { useState, useEffect } from 'react';
import { X, Check, Share2, Camera, Mail, Link } from 'lucide-react';
import Switch from './Switch';

interface Props {
  onFechar: () => void;
}

type Aba = 'rapido' | 'profissional' | 'marcadagua';
type EstadoExport = 'config' | 'progresso' | 'concluido';

export default function Exportacao({ onFechar }: Props) {
  const [aba, setAba] = useState<Aba>('rapido');
  const [estado, setEstado] = useState<EstadoExport>('config');
  const [progresso, setProgresso] = useState(0);
  const [formato, setFormato] = useState('JPEG');
  const [qualidade, setQualidade] = useState(90);
  const [tamanho, setTamanho] = useState('Original');
  const [rede, setRede] = useState('');
  const [cmyk, setCmyk] = useState(false);
  const [espacoCor, setEspacoCor] = useState('sRGB');
  const [camadas, setCamadas] = useState(true);
  const [mascaras, setMascaras] = useState(true);
  const [dpi, setDpi] = useState('300');
  const [opacidadeMarca, setOpacidadeMarca] = useState(70);
  const [tamanhoMarca, setTamanhoMarca] = useState(40);
  const [rotacaoMarca, setRotacaoMarca] = useState(0);
  const [posicaoMarca, setPosicaoMarca] = useState(4);

  const tamanhoEstimado = Math.round((qualidade / 100) * 8.4 * 1024);

  useEffect(() => {
    if (estado === 'progresso') {
      const interval = setInterval(() => {
        setProgresso((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setTimeout(() => setEstado('concluido'), 200);
            return 100;
          }
          return p + 4;
        });
      }, 80);
      return () => clearInterval(interval);
    }
  }, [estado]);

  const iniciarExport = () => {
    setProgresso(0);
    setEstado('progresso');
  };

  const abas: { id: Aba; label: string }[] = [
    { id: 'rapido', label: 'RÁPIDO' },
    { id: 'profissional', label: 'PROFISSIONAL' },
    { id: 'marcadagua', label: "MARCA D'ÁGUA" },
  ];

  const formatos = ['JPEG', 'PNG', 'WebP', 'HEIC', 'GIF'];
  const tamanhos = ['Original', '2x', '1080p', '720p', '480p'];
  const redesSociais = [
    { label: 'Instagram', res: '1080×1080' },
    { label: 'Stories', res: '1080×1920' },
    { label: 'Twitter', res: '1200×675' },
    { label: 'LinkedIn', res: '1200×627' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}
        onClick={onFechar}
      />
      <div
        style={{
          position: 'relative',
          height: '85%',
          background: '#252525',
          borderTop: '1px solid #3C3C3C',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 2, background: '#3C3C3C' }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px 12px',
            borderBottom: '1px solid #3C3C3C',
          }}
        >
          <span style={{ color: '#E4E4E4', fontSize: 16, fontWeight: 500, flex: 1 }}>Exportar</span>
          <button
            onClick={onFechar}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} color="#8E8E8E" />
          </button>
        </div>

        {estado === 'config' && (
          <>
            {/* Abas */}
            <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C' }}>
              {abas.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    borderBottom: aba === a.id ? '2px solid #3A8FDE' : '2px solid transparent',
                    color: aba === a.id ? '#3A8FDE' : '#8E8E8E',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: 0.5,
                    padding: '10px 4px',
                    cursor: 'pointer',
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {aba === 'rapido' && (
                <>
                  <div
                    style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    FORMATO
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    {formatos.map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormato(f)}
                        style={{
                          background: formato === f ? '#3A8FDE' : 'transparent',
                          border: '1px solid',
                          borderColor: formato === f ? '#3A8FDE' : '#3C3C3C',
                          color: formato === f ? '#fff' : '#E4E4E4',
                          fontSize: 12,
                          fontWeight: 500,
                          padding: '5px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <div
                    style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    QUALIDADE
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={qualidade}
                      onChange={(e) => setQualidade(+e.target.value)}
                      style={{ flex: 1, accentColor: '#3A8FDE', height: 2 }}
                    />
                    <span
                      className="mono"
                      style={{ color: '#E4E4E4', fontSize: 13, width: 40, textAlign: 'right' }}
                    >
                      {qualidade}%
                    </span>
                  </div>
                  <div style={{ color: '#8E8E8E', fontSize: 11, marginBottom: 16 }}>
                    Tamanho estimado:{' '}
                    <span className="mono" style={{ color: '#E4E4E4' }}>
                      {tamanhoEstimado} KB
                    </span>
                  </div>

                  <div
                    style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    TAMANHO
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    {tamanhos.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTamanho(t)}
                        style={{
                          background: tamanho === t ? '#3A8FDE' : 'transparent',
                          border: '1px solid',
                          borderColor: tamanho === t ? '#3A8FDE' : '#3C3C3C',
                          color: tamanho === t ? '#fff' : '#E4E4E4',
                          fontSize: 12,
                          padding: '5px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div
                    style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    PREDEFINIÇÕES DE REDE SOCIAL
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {redesSociais.map((r) => (
                      <div
                        key={r.label}
                        onClick={() => setRede(r.label)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: rede === r.label ? 'rgba(58,143,222,0.1)' : '#2F2F2F',
                          border: '1px solid',
                          borderColor: rede === r.label ? '#3A8FDE' : '#3C3C3C',
                          cursor: 'pointer',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ color: '#E4E4E4', fontSize: 14 }}>{r.label}</span>
                        <span className="mono" style={{ color: '#8E8E8E', fontSize: 11 }}>
                          {r.res}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {aba === 'profissional' && (
                <>
                  <div
                    style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    FORMATO PROFISSIONAL
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {['PSD', 'TIFF'].map((f) => (
                      <div
                        key={f}
                        style={{
                          flex: 1,
                          padding: 16,
                          background: '#2F2F2F',
                          border: '1px solid #3C3C3C',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ color: '#3A8FDE', fontSize: 20, fontWeight: 700 }}>{f}</span>
                        <span style={{ color: '#8E8E8E', fontSize: 11 }}>
                          Adobe {f === 'PSD' ? 'Photoshop' : 'TIFF'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      background: '#2F2F2F',
                      border: '1px solid #3C3C3C',
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={camadas}
                        onChange={(e) => setCamadas(e.target.checked)}
                        style={{ accentColor: '#3A8FDE' }}
                      />
                      <span style={{ color: '#E4E4E4', fontSize: 14 }}>Manter camadas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={mascaras}
                        onChange={(e) => setMascaras(e.target.checked)}
                        style={{ accentColor: '#3A8FDE' }}
                      />
                      <span style={{ color: '#E4E4E4', fontSize: 14 }}>Manter máscaras</span>
                    </div>
                  </div>

                  <div
                    style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    DPI
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                    {['72', '150', '300', '600'].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDpi(d)}
                        style={{
                          background: dpi === d ? '#3A8FDE' : 'transparent',
                          border: '1px solid',
                          borderColor: dpi === d ? '#3A8FDE' : '#3C3C3C',
                          color: dpi === d ? '#fff' : '#E4E4E4',
                          fontSize: 12,
                          padding: '5px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  <div
                    style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    ESPAÇO DE COR
                  </div>
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}
                  >
                    {['sRGB', 'Adobe RGB', 'DCI-P3'].map((ec) => (
                      <label
                        key={ec}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                      >
                        <input
                          type="radio"
                          name="ecor"
                          value={ec}
                          checked={espacoCor === ec}
                          onChange={() => setEspacoCor(ec)}
                          style={{ accentColor: '#3A8FDE' }}
                        />
                        <span style={{ color: '#E4E4E4', fontSize: 14 }}>{ec}</span>
                      </label>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#2F2F2F',
                      border: '1px solid #3C3C3C',
                      padding: 12,
                    }}
                  >
                    <Switch label="Simulação CMYK" value={cmyk} onChange={setCmyk} />
                  </div>
                  {cmyk && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(210,160,94,0.12)',
                        border: '1px solid #D2A05E',
                        marginTop: 4,
                      }}
                    >
                      <span style={{ color: '#D2A05E', fontSize: 12 }}>
                        ⚠ CMYK pode alterar cores. Revise antes de imprimir.
                      </span>
                    </div>
                  )}
                </>
              )}

              {aba === 'marcadagua' && (
                <>
                  {/* Preview */}
                  <div style={{ position: 'relative', marginBottom: 16 }}>
                    <img
                      src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=358&h=200&fit=crop&auto=format"
                      alt="Preview com marca d'água"
                      style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                    />
                    {/* Grade de posições 3x3 */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                      }}
                    >
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div
                          key={i}
                          onClick={() => setPosicaoMarca(i)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            border:
                              posicaoMarca === i
                                ? '2px solid #3A8FDE'
                                : '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          {posicaoMarca === i && (
                            <div
                              style={{
                                background: 'rgba(0,0,0,0.7)',
                                color: '#E4E4E4',
                                fontSize: 10,
                                padding: '2px 4px',
                                opacity: opacidadeMarca / 100,
                                transform: `rotate(${rotacaoMarca}deg) scale(${tamanhoMarca / 40})`,
                              }}
                            >
                              @joaosilva
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {[
                    {
                      label: 'Opacidade',
                      val: opacidadeMarca,
                      set: setOpacidadeMarca,
                      unit: '%',
                      min: 0,
                      max: 100,
                    },
                    {
                      label: 'Tamanho',
                      val: tamanhoMarca,
                      set: setTamanhoMarca,
                      unit: 'px',
                      min: 10,
                      max: 100,
                    },
                    {
                      label: 'Rotação',
                      val: rotacaoMarca,
                      set: setRotacaoMarca,
                      unit: '°',
                      min: -180,
                      max: 180,
                    },
                  ].map(({ label, val, set, unit, min, max }) => (
                    <div
                      key={label}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
                    >
                      <span style={{ color: '#8E8E8E', fontSize: 12, width: 70, flexShrink: 0 }}>
                        {label}
                      </span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={val}
                        onChange={(e) => set(+e.target.value)}
                        style={{ flex: 1, accentColor: '#3A8FDE' }}
                      />
                      <span
                        className="mono"
                        style={{ color: '#E4E4E4', fontSize: 12, width: 40, textAlign: 'right' }}
                      >
                        {val}
                        {unit}
                      </span>
                    </div>
                  ))}

                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 6 }}
                    >
                      LINK DO QR CODE
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="https://joaosilva.photo"
                        style={{
                          width: '100%',
                          background: '#2F2F2F',
                          border: '1px solid #3C3C3C',
                          color: '#E4E4E4',
                          fontSize: 13,
                          padding: '8px 12px',
                          fontFamily: 'Roboto, sans-serif',
                        }}
                      />
                    </div>
                  </div>
                  <button
                    style={{
                      width: '100%',
                      marginTop: 12,
                      background: 'transparent',
                      border: '1px solid #3C3C3C',
                      color: '#E4E4E4',
                      fontSize: 13,
                      padding: '8px 0',
                      cursor: 'pointer',
                    }}
                  >
                    Salvar como preset
                  </button>
                </>
              )}
            </div>

            {/* Botão Exportar */}
            <div style={{ padding: 16, borderTop: '1px solid #3C3C3C' }}>
              <button
                onClick={iniciarExport}
                style={{
                  width: '100%',
                  background: '#3A8FDE',
                  border: 'none',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  padding: '13px 0',
                  cursor: 'pointer',
                }}
              >
                Exportar
              </button>
            </div>
          </>
        )}

        {estado === 'progresso' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              gap: 24,
            }}
          >
            <div style={{ width: 80, height: 80, position: 'relative' }}>
              <svg viewBox="0 0 80 80" style={{ width: '100%', height: '100%' }}>
                <circle cx={40} cy={40} r={36} fill="none" stroke="#3C3C3C" strokeWidth={4} />
                <circle
                  cx={40}
                  cy={40}
                  r={36}
                  fill="none"
                  stroke="#3A8FDE"
                  strokeWidth={4}
                  strokeDasharray={226}
                  strokeDashoffset={226 - (226 * progresso) / 100}
                  strokeLinecap="butt"
                  transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dashoffset 0.1s' }}
                />
              </svg>
              <span
                className="mono"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#E4E4E4',
                  fontSize: 18,
                }}
              >
                {progresso}%
              </span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#E4E4E4', fontSize: 15 }}>Exportando...</div>
              <div style={{ color: '#8E8E8E', fontSize: 12, marginTop: 4 }}>
                Ensaio Praia 04.{formato.toLowerCase()}
              </div>
            </div>
          </div>
        )}

        {estado === 'concluido' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: 24,
              gap: 0,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: '#5FB98F',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={24} color="#fff" />
              </div>
              <div>
                <div style={{ color: '#E4E4E4', fontSize: 15, fontWeight: 500 }}>
                  Exportação concluída
                </div>
                <div style={{ color: '#5FB98F', fontSize: 12 }}>Arquivo salvo na galeria</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <img
                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&h=100&fit=crop"
                alt="Miniatura exportada"
                style={{ width: 80, height: 80, objectFit: 'cover' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['Arquivo', `Ensaio Praia 04.${formato.toLowerCase()}`],
                  ['Tamanho', `${tamanhoEstimado} KB`],
                  ['Resolução', '6000 × 4000'],
                  ['Tempo', '2,4 s'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#8E8E8E', fontSize: 12, width: 70 }}>{k}</span>
                    <span className="mono" style={{ color: '#E4E4E4', fontSize: 12 }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ color: '#8E8E8E', fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>
              COMPARTILHAR
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { Icon: Camera, label: 'Instagram' },
                { Icon: Mail, label: 'E-mail' },
                { Icon: Link, label: 'Copiar link' },
                { Icon: Share2, label: 'Mais' },
              ].map(({ Icon, label }) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      background: '#2F2F2F',
                      border: '1px solid #3C3C3C',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} color="#B0B0B0" />
                  </div>
                  <span style={{ color: '#8E8E8E', fontSize: 10 }}>{label}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onFechar}
              style={{
                marginTop: 'auto',
                width: '100%',
                background: '#3A8FDE',
                border: 'none',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                padding: '13px 0',
                cursor: 'pointer',
              }}
            >
              Concluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
