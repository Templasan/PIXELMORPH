import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  open: boolean;
  onClose: () => void;
  navigate: (s: Screen) => void;
  currentScreen: Screen;
}

const navItems: { icon: string; label: string; screen: Screen | null }[] = [
  { icon: 'folder', label: 'Projetos', screen: 'projects' },
  { icon: 'camera', label: 'Câmera', screen: 'camera' },
  { icon: 'users', label: 'Comunidade', screen: 'community' },
  { icon: 'bookOpen', label: 'Tutoriais', screen: 'tutorials' as Screen },
  { icon: 'star', label: 'Presets', screen: 'presets' as Screen },
  { icon: 'save', label: 'Armazenamento', screen: 'storage' as Screen },
];

export default function SideDrawer({ open, onClose, navigate, currentScreen }: Props) {
  return (
    <>
      {open && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }}
          onClick={onClose}
        />
      )}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: 312,
          zIndex: 50,
          background: '#252525',
          borderRight: '1px solid #3C3C3C',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.22s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Profile header */}
        <div
          style={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderBottom: '1px solid #3C3C3C',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: '#3A8FDE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              marginRight: 12,
            }}
          >
            JS
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#E4E4E4', fontWeight: 500 }}>João Silva</div>
            <div style={{ fontSize: 12, color: '#8E8E8E' }}>joao@pixelmorph.com</div>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
          {navItems.map(({ icon, label, screen }) => {
            const isActive = screen !== null && currentScreen === screen;
            return (
              <button
                key={label}
                onClick={() => (screen ? navigate(screen) : onClose())}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  fontSize: 14,
                  color: isActive ? '#3A8FDE' : '#E4E4E4',
                  background: isActive ? 'rgba(58,143,222,0.1)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Icon name={icon} size={20} color={isActive ? '#3A8FDE' : '#B0B0B0'} />
                {label}
              </button>
            );
          })}

          <div style={{ borderTop: '1px solid #3C3C3C', marginTop: 8, paddingTop: 8 }}>
            <button
              onClick={() => navigate('account' as Screen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                fontSize: 14,
                color: currentScreen === 'account' ? '#3A8FDE' : '#E4E4E4',
                background: currentScreen === 'account' ? 'rgba(58,143,222,0.1)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Icon
                name="settings"
                size={20}
                color={currentScreen === 'account' ? '#3A8FDE' : '#B0B0B0'}
              />
              Conta e preferências
            </button>
            <button
              onClick={() => navigate('help' as Screen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                fontSize: 14,
                color: currentScreen === 'help' ? '#3A8FDE' : '#E4E4E4',
                background: currentScreen === 'help' ? 'rgba(58,143,222,0.1)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Icon
                name="help"
                size={20}
                color={currentScreen === 'help' ? '#3A8FDE' : '#B0B0B0'}
              />
              Ajuda
            </button>
          </div>
        </div>

        {/* Storage footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #3C3C3C' }}>
          <div
            style={{
              fontSize: 12,
              color: '#8E8E8E',
              marginBottom: 6,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            4,2 GB de 10 GB usados
          </div>
          <div style={{ height: 2, background: '#3C3C3C' }}>
            <div style={{ width: '42%', height: '100%', background: '#3A8FDE' }} />
          </div>
        </div>
      </div>
    </>
  );
}
