import { useState, useRef, KeyboardEvent } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
}

export default function LoginScreen({ navigate }: Props) {
  const [step, setStep] = useState<'login' | '2fa'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [timer] = useState(42);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleLogin = () => {
    setStep('2fa');
  };

  const handleCodeChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };

  const handleCodeKey = (i: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const handleVerify = () => {
    if (code.join('').length === 6) navigate('projects');
    else navigate('projects'); // allow quick demo
  };

  if (step === '2fa') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#1A1A1A',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              border: '2px solid #3A8FDE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="shield" size={32} color="#3A8FDE" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#E4E4E4' }}>
              Verificação em duas etapas
            </div>
            <div style={{ fontSize: 13, color: '#8E8E8E', marginTop: 4 }}>
              Digite o código enviado para seu e-mail
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {code.map((v, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={v}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                onKeyDown={(e) => handleCodeKey(i, e)}
                style={{
                  width: 48,
                  height: 48,
                  textAlign: 'center',
                  fontSize: 20,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#E4E4E4',
                  background: '#2F2F2F',
                  border: `1px solid ${v ? '#3A8FDE' : '#3C3C3C'}`,
                  borderRadius: 0,
                  outline: 'none',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#8E8E8E' }}>
            Reenviar código em{' '}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#E4E4E4' }}>
              00:{String(timer).padStart(2, '0')}
            </span>
          </div>
          <button
            onClick={handleVerify}
            style={{
              width: '100%',
              height: 44,
              background: '#3A8FDE',
              color: '#0D0D0D',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            Verificar
          </button>
          <button
            style={{
              fontSize: 12,
              color: '#3A8FDE',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Usar app autenticador
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#1A1A1A',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#E4E4E4', letterSpacing: '-0.5px' }}>
            PixelMorph
          </div>
          <div style={{ fontSize: 13, color: '#8E8E8E', marginTop: 2 }}>Editor de foto e vídeo</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8E8E8E',
                marginBottom: 6,
              }}
            >
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
              style={{
                width: '100%',
                height: 40,
                background: '#2F2F2F',
                border: '1px solid #3C3C3C',
                padding: '0 12px',
                fontSize: 14,
                color: '#E4E4E4',
                outline: 'none',
                borderRadius: 0,
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8E8E8E',
                marginBottom: 6,
              }}
            >
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  height: 40,
                  background: '#2F2F2F',
                  border: '1px solid #3C3C3C',
                  padding: '0 40px 0 12px',
                  fontSize: 14,
                  color: '#E4E4E4',
                  outline: 'none',
                  borderRadius: 0,
                }}
              />
              <button
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={18} color="#8E8E8E" />
              </button>
            </div>
          </div>
          <button
            style={{
              alignSelf: 'flex-start',
              fontSize: 12,
              color: '#3A8FDE',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Esqueci minha senha
          </button>
        </div>

        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            height: 44,
            background: '#3A8FDE',
            color: '#0D0D0D',
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 0,
          }}
        >
          Entrar
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#3C3C3C' }} />
          <span style={{ fontSize: 12, color: '#8E8E8E' }}>ou</span>
          <div style={{ flex: 1, height: 1, background: '#3C3C3C' }} />
        </div>

        <button
          onClick={() => navigate('signup')}
          style={{
            width: '100%',
            height: 44,
            background: 'transparent',
            border: '1px solid #3C3C3C',
            color: '#E4E4E4',
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            borderRadius: 0,
          }}
        >
          Criar conta
        </button>
      </div>

      <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'center', gap: 24 }}>
        {['PT', 'EN', 'ES'].map((lang) => (
          <button
            key={lang}
            style={{
              fontSize: 12,
              color: lang === 'PT' ? '#E4E4E4' : '#8E8E8E',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {lang}
          </button>
        ))}
      </div>
    </div>
  );
}
