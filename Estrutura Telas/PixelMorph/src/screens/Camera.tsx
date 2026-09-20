import { useState, useEffect } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
}

type CameraMode = 'FOTO' | 'VÍDEO' | 'TEMPORIZADOR' | 'STOP-MOTION' | 'AR';

const FILTERS = [
  { name: 'Original', filter: 'none' },
  { name: 'Vívido', filter: 'saturate(1.9) contrast(1.15)' },
  { name: 'Retrô 400', filter: 'sepia(0.35) saturate(0.75) contrast(1.12)' },
  { name: 'Frio', filter: 'hue-rotate(195deg) saturate(0.7) brightness(1.05)' },
  { name: 'Sépia', filter: 'sepia(0.85)' },
  { name: 'P&B', filter: 'grayscale(1)' },
  { name: 'Cine', filter: 'contrast(1.3) brightness(0.82) saturate(0.55)' },
];

const MODES: CameraMode[] = ['FOTO', 'VÍDEO', 'TEMPORIZADOR', 'STOP-MOTION', 'AR'];

export default function CameraScreen({ navigate }: Props) {
  const [activeFilter, setActiveFilter] = useState(0);
  const [intensity, setIntensity] = useState(100);
  const [mode, setMode] = useState<CameraMode>('FOTO');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stopFrames, setStopFrames] = useState<number[]>([]);
  const [recording, setRecording] = useState(false);
  const [stopFps, setStopFps] = useState(6);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleShutter = () => {
    if (mode === 'TEMPORIZADOR') {
      setCountdown(3);
    } else if (mode === 'STOP-MOTION') {
      setStopFrames((prev) => [...prev, prev.length + 1]);
    } else if (mode === 'VÍDEO') {
      setRecording((r) => !r);
    } else {
      navigate('photoEditor');
    }
  };

  const filterStyle = FILTERS[activeFilter].filter;

  const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#000',
        position: 'relative',
      }}
    >
      {/* Preview */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <img
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=390&h=600&fit=crop&auto=format"
          alt="Camera preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: filterStyle,
            opacity: (intensity / 100) * (1 - (100 - intensity) / 100) + (100 - intensity) / 100,
          }}
        />

        {/* Top controls */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 52,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={() => navigate('projects')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Icon name="chevronLeft" size={24} color="#fff" />
          </button>
          <div style={{ display: 'flex', gap: 20 }}>
            <Icon name="flash" size={20} color="#fff" />
            <Icon name="grid" size={20} color="#fff" />
            <Icon name="rotate" size={20} color="#fff" />
          </div>
          <div
            style={{
              padding: '2px 6px',
              border: '1px solid #5FB98F',
              background: 'rgba(95,185,143,0.2)',
            }}
          >
            <span style={{ ...M, fontSize: 11, color: '#5FB98F' }}>60 FPS</span>
          </div>
        </div>

        {/* Countdown */}
        {countdown !== null && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.35)',
            }}
          >
            <span style={{ ...M, fontSize: 96, fontWeight: 700, color: '#fff' }}>{countdown}</span>
          </div>
        )}

        {/* Stop-motion frames */}
        {mode === 'STOP-MOTION' && stopFrames.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 56,
              left: 8,
              right: 8,
              display: 'flex',
              gap: 4,
              overflowX: 'auto',
            }}
          >
            {stopFrames.map((f) => (
              <div
                key={f}
                style={{
                  flexShrink: 0,
                  width: 48,
                  height: 48,
                  background: 'rgba(26,26,26,0.85)',
                  border: '1px solid #3C3C3C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ ...M, fontSize: 11, color: '#8E8E8E' }}>{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* AR overlay */}
        {mode === 'AR' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ position: 'relative', width: 200, height: 200 }}>
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'rgba(58,143,222,0.75)',
                    left: `${(i % 5) * 25}%`,
                    top: `${Math.floor(i / 5) * 25}%`,
                  }}
                />
              ))}
              <div
                style={{
                  position: 'absolute',
                  inset: 40,
                  border: '2px solid rgba(58,143,222,0.8)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  background: 'rgba(58,143,222,0.15)',
                  border: '1px solid #3A8FDE',
                  padding: '4px 8px',
                }}
              >
                <span style={{ fontSize: 10, color: '#3A8FDE' }}>Superfície detectada</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter carousel */}
      <div style={{ background: 'rgba(0,0,0,0.88)', paddingTop: 8 }}>
        <div style={{ display: 'flex', gap: 8, padding: '0 8px 8px', overflowX: 'auto' }}>
          {FILTERS.map((f, i) => (
            <button
              key={f.name}
              onClick={() => setActiveFilter(i)}
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  border: `1px solid ${activeFilter === i ? '#3A8FDE' : '#3C3C3C'}`,
                  overflow: 'hidden',
                }}
              >
                <img
                  src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=56&h=56&fit=crop&auto=format"
                  alt={f.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: f.filter }}
                />
              </div>
              <span style={{ fontSize: 9, color: activeFilter === i ? '#3A8FDE' : '#8E8E8E' }}>
                {f.name}
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 8px' }}>
          <span style={{ fontSize: 10, color: '#8E8E8E', whiteSpace: 'nowrap' }}>Intensidade</span>
          <input
            type="range"
            min={0}
            max={100}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ ...M, fontSize: 10, color: '#E4E4E4', width: 24, textAlign: 'right' }}>
            {intensity}
          </span>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ background: 'rgba(0,0,0,0.9)', padding: '8px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            overflowX: 'auto',
            padding: '0 16px',
          }}
        >
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                fontSize: 11,
                letterSpacing: '0.06em',
                color: mode === m ? '#3A8FDE' : '#8E8E8E',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                fontWeight: mode === m ? 500 : 400,
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '12px 24px',
        }}
      >
        <div style={{ width: 48, height: 48, overflow: 'hidden', border: '1px solid #3C3C3C' }}>
          <img
            src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=48&h=48&fit=crop&auto=format"
            alt="Last capture"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <button
          onClick={handleShutter}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: `4px solid ${mode === 'STOP-MOTION' || (mode === 'VÍDEO' && recording) ? '#D25252' : '#fff'}`,
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {mode === 'VÍDEO' ? (
            <div
              style={{
                width: recording ? 20 : 48,
                height: recording ? 20 : 48,
                background: '#D25252',
                borderRadius: recording ? 2 : '50%',
                transition: 'all 0.2s',
              }}
            />
          ) : mode === 'STOP-MOTION' ? (
            <div style={{ width: 20, height: 20, background: '#D25252', borderRadius: 2 }} />
          ) : (
            <div style={{ width: 56, height: 56, background: '#fff', borderRadius: '50%' }} />
          )}
        </button>

        <button
          onClick={() => navigate('projects')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <Icon name="rotate" size={28} color="#B0B0B0" />
        </button>
      </div>

      {/* Stop-motion fps slider */}
      {mode === 'STOP-MOTION' && (
        <div
          style={{
            background: 'rgba(0,0,0,0.95)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px 10px',
          }}
        >
          <span style={{ fontSize: 10, color: '#8E8E8E', whiteSpace: 'nowrap' }}>
            Taxa de reprodução
          </span>
          <input
            type="range"
            min={1}
            max={24}
            value={stopFps}
            onChange={(e) => setStopFps(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ ...M, fontSize: 10, color: '#E4E4E4', whiteSpace: 'nowrap' }}>
            {stopFps} fps
          </span>
        </div>
      )}
    </div>
  );
}
