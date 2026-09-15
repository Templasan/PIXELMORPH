import { useRef } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  bipolar?: boolean;
  colorTrack?: string;
  labelWidth?: number;
  onChange: (val: number) => void;
}

export default function Slider({ label, value, min, max, unit = '', bipolar = false, colorTrack, labelWidth = 90, onChange }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const update = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(Math.round(min + ratio * (max - min)));
  };

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
      <span style={{ color: '#8E8E8E', fontSize: 12, width: labelWidth, flexShrink: 0 }}>{label}</span>
      <div
        ref={trackRef}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); update(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons > 0) update(e.clientX); }}
        style={{ flex: 1, height: 2, background: colorTrack || '#3C3C3C', position: 'relative', cursor: 'pointer' }}
      >
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: '100%', background: '#3A8FDE' }} />
        {bipolar && (
          <div style={{ position: 'absolute', left: '50%', top: -3, width: 1, height: 8, background: '#8E8E8E', transform: 'translateX(-50%)' }} />
        )}
        <div style={{
          position: 'absolute',
          left: `calc(${pct}% - 6px)`,
          top: -5,
          width: 12,
          height: 12,
          background: '#E4E4E4',
          cursor: 'grab',
        }} />
      </div>
      <span className="mono" style={{ fontSize: 12, color: '#E4E4E4', width: 40, textAlign: 'right', flexShrink: 0 }}>
        {value}{unit}
      </span>
    </div>
  );
}
