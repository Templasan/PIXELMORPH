import { useState, useRef, useCallback } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
  onOpenDrawer: () => void;
  onExport: () => void;
}

const DURATION = 154; // 2:34 in seconds

function formatTimecode(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const fr = Math.floor((s % 1) * 30);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
}

const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

const tracks = [
  {
    id: 'v2',
    label: 'V2',
    type: 'video',
    clips: [{ start: 0.08, end: 0.45, name: 'B-roll Praia', color: '#1E3A5C' }],
  },
  {
    id: 'v1',
    label: 'V1',
    type: 'video',
    clips: [{ start: 0, end: 1, name: 'Viagem Litoral', color: '#152C44' }],
  },
  {
    id: 'txt',
    label: 'TXT',
    type: 'text',
    clips: [{ start: 0.18, end: 0.62, name: 'Legenda principal', color: '#1E1E40' }],
  },
  {
    id: 'a1',
    label: 'A1',
    type: 'audio',
    clips: [{ start: 0, end: 1, name: 'Trilha principal', color: '#122A1E' }],
  },
  {
    id: 'a2',
    label: 'A2',
    type: 'audio',
    clips: [{ start: 0.04, end: 0.55, name: 'Ambient ocean', color: '#0E1F16' }],
  },
];

export default function VideoEditorScreen({ navigate, onOpenDrawer, onExport }: Props) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(134.27);
  const [timelineZoom, setTimelineZoom] = useState(50);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [clipTab, setClipTab] = useState('Aparar');
  const [trackVis, setTrackVis] = useState<Record<string, boolean>>({
    v2: true,
    v1: true,
    txt: true,
    a1: true,
    a2: true,
  });
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleTimelineTap = useCallback((e: React.MouseEvent) => {
    const el = timelineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const trackStart = 72;
    const pct = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left - trackStart) / (rect.width - trackStart))
    );
    setCurrentTime(pct * DURATION);
  }, []);

  const handleTimelineDrag = useCallback((clientX: number) => {
    const el = timelineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const trackStart = 72;
    const pct = Math.max(
      0,
      Math.min(1, (clientX - rect.left - trackStart) / (rect.width - trackStart))
    );
    setCurrentTime(pct * DURATION);
  }, []);

  const playheadPct = (currentTime / DURATION) * 100;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1A1A1A' }}
    >
      {/* Top bar */}
      <div
        style={{
          height: 48,
          background: '#252525',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          borderBottom: '1px solid #3C3C3C',
          boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate('projects')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <Icon name="chevronLeft" size={20} color="#B0B0B0" />
        </button>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            color: '#E4E4E4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Viagem Litoral<span style={{ color: '#D25252' }}>●</span>
        </span>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <Icon name="undo" size={18} color="#B0B0B0" />
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <Icon name="redo" size={18} color="#B0B0B0" />
        </button>
        <button
          onClick={onExport}
          style={{
            padding: '4px 10px',
            background: '#3A8FDE',
            color: '#0D0D0D',
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Exportar
        </button>
      </div>

      {/* Video preview panel */}
      <div style={{ position: 'relative', background: '#000', flexShrink: 0, height: '34%' }}>
        <img
          src="https://images.unsplash.com/photo-1504700610630-ac6aba3536d3?w=390&h=220&fit=crop&auto=format"
          alt="Video preview"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* 4K badge */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.7)',
            padding: '2px 6px',
            border: '1px solid #3C3C3C',
          }}
        >
          <span style={{ ...M, fontSize: 11, color: '#5FB98F' }}>4K · 30 fps</span>
        </div>
        {/* Transport overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(0,0,0,0.72)',
            padding: '8px 16px 10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ ...M, fontSize: 13, color: '#E4E4E4' }}>
              {formatTimecode(currentTime)}
            </span>
            <span style={{ ...M, fontSize: 13, color: '#8E8E8E' }}>{formatTimecode(DURATION)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Icon name="skipBack" size={20} color="#B0B0B0" />
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Icon name="rewindFrame" size={18} color="#B0B0B0" />
            </button>
            <button
              onClick={() => setPlaying((p) => !p)}
              style={{
                width: 36,
                height: 36,
                border: '1px solid #E4E4E4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <Icon name={playing ? 'pause' : 'play'} size={18} color="#E4E4E4" />
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Icon name="forwardFrame" size={18} color="#B0B0B0" />
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Icon name="skipForward" size={20} color="#B0B0B0" />
            </button>
          </div>
        </div>
      </div>

      {/* Divider handle */}
      <div style={{ height: 3, background: '#3C3C3C', cursor: 'row-resize', flexShrink: 0 }} />

      {/* Timeline */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <div
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}
          ref={timelineRef}
          onClick={handleTimelineTap}
        >
          {/* Time ruler */}
          <div
            style={{
              height: 24,
              background: '#1F1F1F',
              borderBottom: '1px solid #3C3C3C',
              display: 'flex',
              paddingLeft: 72,
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            {Array.from({ length: 11 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderLeft: '1px solid #3C3C3C',
                  paddingLeft: 3,
                  display: 'flex',
                  alignItems: 'flex-end',
                  paddingBottom: 2,
                }}
              >
                <span style={{ ...M, fontSize: 9, color: '#8E8E8E' }}>
                  {formatTimecode((DURATION / 10) * i).slice(0, 5)}
                </span>
              </div>
            ))}
            {/* Playhead on ruler */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: 1,
                background: '#D25252',
                left: `calc(72px + ${(currentTime / DURATION) * 100}%)`,
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Track rows */}
          {tracks.map((track) => (
            <div
              key={track.id}
              style={{
                display: 'flex',
                height: 48,
                borderBottom: '1px solid #3C3C3C',
                position: 'relative',
              }}
            >
              {/* Track header */}
              <div
                style={{
                  width: 72,
                  flexShrink: 0,
                  background: '#252525',
                  borderRight: '1px solid #3C3C3C',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 6px',
                  gap: 4,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTrackVis((v) => ({ ...v, [track.id]: !v[track.id] }));
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <Icon
                    name={trackVis[track.id] ? 'eye' : 'eyeOff'}
                    size={12}
                    color={trackVis[track.id] ? '#8E8E8E' : '#444'}
                  />
                </button>
                <span style={{ ...M, fontSize: 11, color: '#8E8E8E', fontWeight: 500 }}>
                  {track.label}
                </span>
                <button
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Icon name="lock" size={10} color="#555" />
                </button>
              </div>

              {/* Clip area */}
              <div
                style={{ flex: 1, background: '#1A1A1A', position: 'relative', cursor: 'pointer' }}
                onMouseMove={(e) => {
                  if (e.buttons === 1) handleTimelineDrag(e.clientX);
                }}
              >
                {/* Playhead line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'rgba(210,82,82,0.4)',
                    left: `${playheadPct}%`,
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />

                {/* Clips */}
                {trackVis[track.id] &&
                  track.clips.map((clip, ci) => {
                    const clipId = `${track.id}-${ci}`;
                    const isSelected = selectedClip === clipId;
                    return (
                      <div
                        key={ci}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClip(isSelected ? null : clipId);
                        }}
                        style={{
                          position: 'absolute',
                          top: 4,
                          bottom: 4,
                          left: `${clip.start * 100}%`,
                          width: `${(clip.end - clip.start) * 100}%`,
                          background: clip.color,
                          borderLeft: '2px solid rgba(255,255,255,0.15)',
                          borderRight: '2px solid rgba(255,255,255,0.15)',
                          outline: isSelected ? '1px solid #3A8FDE' : 'none',
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            color: 'rgba(228,228,228,0.65)',
                            padding: '2px 4px',
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {clip.name}
                        </span>
                        {track.type === 'audio' && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 2,
                              left: 4,
                              right: 4,
                              height: 16,
                              display: 'flex',
                              alignItems: 'flex-end',
                              gap: 0,
                            }}
                          >
                            {Array.from({ length: 40 }).map((_, j) => (
                              <div
                                key={j}
                                style={{
                                  flex: 1,
                                  background: '#5FB98F',
                                  opacity: 0.6,
                                  height: `${30 + Math.sin(j * 0.7) * 65}%`,
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* Selected clip panel */}
        {selectedClip && (
          <div
            style={{
              background: '#252525',
              borderTop: '1px solid #3C3C3C',
              padding: '10px 14px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              {['Aparar', 'Quadro', 'Correção'].map((t) => (
                <button
                  key={t}
                  onClick={() => setClipTab(t)}
                  style={{
                    fontSize: 11,
                    color: clipTab === t ? '#3A8FDE' : '#8E8E8E',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => setSelectedClip(null)}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Icon name="x" size={16} color="#8E8E8E" />
              </button>
            </div>
            {clipTab === 'Aparar' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...M, fontSize: 11, color: '#8E8E8E' }}>Início</span>
                <span style={{ ...M, fontSize: 11, color: '#3A8FDE' }}>00:00:12:00</span>
                <div style={{ flex: 1 }} />
                <span style={{ ...M, fontSize: 11, color: '#8E8E8E' }}>Fim</span>
                <span style={{ ...M, fontSize: 11, color: '#3A8FDE' }}>00:02:34:00</span>
              </div>
            )}
            {clipTab === 'Quadro' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{
                    padding: '4px 10px',
                    border: '1px solid #3C3C3C',
                    fontSize: 11,
                    color: '#E4E4E4',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  −1 quadro
                </button>
                <button
                  style={{
                    padding: '4px 10px',
                    border: '1px solid #3C3C3C',
                    fontSize: 11,
                    color: '#E4E4E4',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  +1 quadro
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 16,
                      background: '#1F1F1F',
                      border: '1px solid #3C3C3C',
                      borderRadius: 8,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        background: '#E4E4E4',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: 1,
                        left: 1,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: '#8E8E8E' }}>Revisar em loop</span>
                </div>
              </div>
            )}
            {clipTab === 'Correção' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#8E8E8E' }}>Brilho</span>
                  <input type="range" min={-100} max={100} defaultValue={0} style={{ flex: 1 }} />
                  <span
                    style={{ ...M, fontSize: 11, color: '#E4E4E4', width: 24, textAlign: 'right' }}
                  >
                    0
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom toolbar */}
        <div
          style={{
            background: '#252525',
            borderTop: '1px solid #3C3C3C',
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', gap: 12, flex: 1 }}>
            {[
              { icon: 'scissors', label: 'Selecionar' },
              { icon: 'crop', label: 'Cortar' },
              { icon: 'zap', label: 'Dividir' },
              { icon: 'ripple', label: 'Ripple' },
              { icon: 'sun', label: 'Zoom' },
            ].map(({ icon, label }) => (
              <button
                key={label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Icon name={icon} size={18} color="#B0B0B0" />
                <span style={{ fontSize: 9, color: '#8E8E8E' }}>{label}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 88 }}>
            <Icon name="search" size={12} color="#8E8E8E" />
            <input
              type="range"
              min={10}
              max={200}
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
