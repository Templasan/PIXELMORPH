import { useState } from 'react';
import { Icon } from '../icons';

interface Props {
  onClose: () => void;
}

const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

type ExportState = 'idle' | 'exporting' | 'done';

function Slider({ label, value, onChange, min = 0, max = 100 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
      <span style={{ fontSize: 12, color: '#8E8E8E', width: 80, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 20, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: '#3C3C3C' }} />
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', width: 12, height: 12, background: '#E4E4E4', left: `calc(${pct}% - 6px)`, pointerEvents: 'none' }} />
      </div>
      <span style={{ ...M, fontSize: 12, color: '#E4E4E4', width: 32, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function ExportModal({ onClose }: Props) {
  const [tab, setTab] = useState('RÁPIDO');
  const [format, setFormat] = useState('JPEG');
  const [quality, setQuality] = useState(85);
  const [sizeChip, setSizeChip] = useState('Original');
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [progress, setProgress] = useState(0);
  const [opacity, setOpacity] = useState(60);
  const [wmSize, setWmSize] = useState(20);

  const estimatedSize = Math.max(1, Math.round(quality * 0.44));

  const handleExport = () => {
    setExportState('exporting');
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15 + 5;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setProgress(100);
        setTimeout(() => setExportState('done'), 200);
      } else {
        setProgress(Math.round(p));
      }
    }, 120);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.65)' }}>
      <div
        style={{ background: '#252525', borderTop: '1px solid #3C3C3C', display: 'flex', flexDirection: 'column', height: '88%' }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 32, height: 3, background: '#3C3C3C' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: '#E4E4E4' }}>Exportar</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icon name="x" size={20} color="#B0B0B0" />
          </button>
        </div>

        {exportState === 'done' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 24px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 80, height: 80, overflow: 'hidden', border: '1px solid #3C3C3C' }}>
                <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=80&h=80&fit=crop&auto=format" alt="Exported" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ position: 'absolute', bottom: -10, right: -10, width: 28, height: 28, background: '#5FB98F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={16} color="#0D0D0D" />
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#E4E4E4' }}>Exportação concluída</div>
              <div style={{ ...M, fontSize: 12, color: '#8E8E8E', marginTop: 4 }}>
                {format} · 6000×4000 · {estimatedSize} MB · 2,3 s
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'center' }}>
              {[
                { icon: 'save', label: 'Salvar' },
                { icon: 'upload', label: 'Enviar' },
                { icon: 'link', label: 'Copiar link' },
                { icon: 'printer', label: 'Imprimir' },
                { icon: 'share', label: 'Mais' },
              ].map(({ icon, label }) => (
                <button
                  key={label}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 10px', border: '1px solid #3C3C3C', background: 'transparent', cursor: 'pointer', flex: 1 }}
                >
                  <Icon name={icon} size={18} color="#B0B0B0" />
                  <span style={{ fontSize: 9, color: '#8E8E8E', textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              style={{ width: '100%', height: 44, background: '#3A8FDE', color: '#0D0D0D', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer' }}
            >
              Concluído
            </button>
          </div>
        ) : exportState === 'exporting' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 24px' }}>
            <div style={{ fontSize: 14, color: '#E4E4E4' }}>Processando...</div>
            <div style={{ width: '100%', height: 2, background: '#3C3C3C' }}>
              <div style={{ height: '100%', background: '#3A8FDE', width: `${progress}%`, transition: 'width 0.12s linear' }} />
            </div>
            <span style={{ ...M, fontSize: 13, color: '#8E8E8E' }}>{progress}%</span>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #3C3C3C', margin: '0 16px 0', overflowX: 'auto' }}>
              {['RÁPIDO', 'PROFISSIONAL', "MARCA D'ÁGUA"].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '8px 12px',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    color: tab === t ? '#3A8FDE' : '#8E8E8E',
                    background: 'none',
                    border: 'none',
                    borderBottom: tab === t ? '2px solid #3A8FDE' : '2px solid transparent',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {tab === 'RÁPIDO' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8E8E8E', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Formato</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['JPEG', 'PNG', 'WebP', 'HEIC', 'GIF'].map(f => (
                        <button
                          key={f}
                          onClick={() => setFormat(f)}
                          style={{ padding: '5px 14px', fontSize: 12, border: `1px solid ${format === f ? '#3A8FDE' : '#3C3C3C'}`, color: format === f ? '#3A8FDE' : '#8E8E8E', background: 'transparent', cursor: 'pointer' }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#8E8E8E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Qualidade</span>
                      <span style={{ ...M, fontSize: 11, color: '#E4E4E4' }}>{quality}% · ~{estimatedSize} MB</span>
                    </div>
                    <div style={{ height: 20, position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: '#3C3C3C' }} />
                      <input type="range" min={10} max={100} value={quality} onChange={e => setQuality(Number(e.target.value))}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                      <div style={{ position: 'absolute', width: 12, height: 12, background: '#E4E4E4', left: `calc(${((quality - 10) / 90) * 100}% - 6px)`, pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8E8E8E', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Tamanho</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['Original', '2K', '1080p', '720p'].map(s => (
                        <button
                          key={s}
                          onClick={() => setSizeChip(s)}
                          style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${sizeChip === s ? '#3A8FDE' : '#3C3C3C'}`, color: sizeChip === s ? '#3A8FDE' : '#8E8E8E', background: 'transparent', cursor: 'pointer' }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8E8E8E', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Redes sociais</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[['Instagram Feed', '1080×1080'], ['Instagram Story', '1080×1920'], ['Twitter / X', '1200×675'], ['LinkedIn', '1200×627']].map(([name, res]) => (
                        <button
                          key={name}
                          style={{ padding: '10px 8px', border: '1px solid #3C3C3C', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'transparent', cursor: 'pointer' }}
                        >
                          <span style={{ fontSize: 12, color: '#E4E4E4' }}>{name}</span>
                          <span style={{ ...M, fontSize: 10, color: '#8E8E8E' }}>{res}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'PROFISSIONAL' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[['PSD', 'Adobe Photoshop'], ['TIFF', 'Sem perdas']].map(([fmt, desc]) => (
                      <button
                        key={fmt}
                        style={{ padding: '14px 8px', border: '1px solid #3C3C3C', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'transparent', cursor: 'pointer' }}
                      >
                        <span style={{ ...M, fontSize: 16, color: '#3A8FDE' }}>{fmt}</span>
                        <span style={{ fontSize: 11, color: '#8E8E8E' }}>{desc}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {['Manter camadas', 'Incluir máscaras', 'Incorporar perfil ICC'].map(opt => (
                      <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 16, height: 16, border: '1px solid #3C3C3C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Icon name="check" size={10} color="#3A8FDE" />
                        </div>
                        <span style={{ fontSize: 13, color: '#E4E4E4' }}>{opt}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8E8E8E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>DPI</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['72', '150', '300', '600'].map(d => (
                        <button
                          key={d}
                          style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${d === '300' ? '#3A8FDE' : '#3C3C3C'}`, color: d === '300' ? '#3A8FDE' : '#8E8E8E', background: 'transparent', cursor: 'pointer', ...M }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: 'rgba(210,160,94,0.1)', border: '1px solid rgba(210,160,94,0.3)' }}>
                    <Icon name="triangle" size={14} color="#D2A05E" />
                    <span style={{ fontSize: 11, color: '#D2A05E', lineHeight: 1.4 }}>Simulação CMYK pode alterar as cores do perfil RGB</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#8E8E8E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Espaço de cor</div>
                    {['sRGB', 'Adobe RGB', 'DCI-P3'].map(cs => (
                      <div key={cs} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${cs === 'Adobe RGB' ? '#3A8FDE' : '#3C3C3C'}`, background: cs === 'Adobe RGB' ? '#3A8FDE' : 'transparent' }} />
                        <span style={{ fontSize: 13, color: '#E4E4E4' }}>{cs}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "MARCA D'ÁGUA" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ position: 'relative', aspectRatio: '16/9', background: '#1F1F1F', border: '1px solid #3C3C3C', overflow: 'hidden' }}>
                    <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=320&h=180&fit=crop&auto=format" alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65 }} />
                    <div style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 12, color: `rgba(228,228,228,${opacity / 100})`, fontFamily: 'Roboto', userSelect: 'none' }}>@joaosilva</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    {['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'].map((p, i) => (
                      <button
                        key={p}
                        style={{ height: 32, border: `1px solid ${i === 8 ? '#3A8FDE' : '#3C3C3C'}`, fontSize: 14, color: i === 8 ? '#3A8FDE' : '#8E8E8E', background: 'transparent', cursor: 'pointer' }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <Slider label="Opacidade" value={opacity} onChange={setOpacity} />
                  <Slider label="Tamanho" value={wmSize} onChange={setWmSize} min={5} max={80} />
                  <Slider label="Rotação" value={0} onChange={() => {}} min={-180} max={180} />
                </div>
              )}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid #3C3C3C', flexShrink: 0 }}>
              <button
                onClick={handleExport}
                style={{ width: '100%', height: 44, background: '#3A8FDE', color: '#0D0D0D', fontSize: 14, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}
              >
                Exportar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
