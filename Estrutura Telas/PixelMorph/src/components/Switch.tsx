interface SwitchProps {
  value: boolean;
  onChange: (val: boolean) => void;
  label?: string;
}

export default function Switch({ value, onChange, label }: SwitchProps) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '2px 0' }}
      onClick={() => onChange(!value)}
    >
      {label && <span style={{ color: '#E4E4E4', fontSize: 14, flex: 1 }}>{label}</span>}
      <div
        style={{
          width: 36,
          height: 14,
          background: value ? 'rgba(58,143,222,0.3)' : '#3C3C3C',
          borderRadius: 7,
          position: 'relative',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -3,
            left: value ? 16 : -2,
            width: 20,
            height: 20,
            background: value ? '#3A8FDE' : '#8E8E8E',
            borderRadius: '50%',
            transition: 'left 0.15s, background 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  );
}
