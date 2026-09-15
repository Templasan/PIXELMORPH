import { useState } from 'react';
import { Screen } from '../App';
import { Icon } from '../icons';

interface Props {
  navigate: (s: Screen) => void;
}

export default function SignUpScreen({ navigate }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [terms, setTerms] = useState(false);

  const passwordsMatch = confirm === '' || password === confirm;
  const canSubmit = name.trim() && email.trim() && password.length >= 8 && password === confirm && terms;

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#8E8E8E',
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 40,
    background: '#2F2F2F',
    border: '1px solid #3C3C3C',
    padding: '0 12px',
    fontSize: 14,
    color: '#E4E4E4',
    outline: 'none',
    borderRadius: 0,
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1A1A1A' }}>
      {/* Top bar */}
      <div style={{ height: 52, background: '#252525', borderBottom: '1px solid #3C3C3C', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
        <button onClick={() => navigate('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Icon name="chevronLeft" size={22} color="#B0B0B0" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#E4E4E4' }}>Criar conta</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#E4E4E4', letterSpacing: '-0.3px' }}>PixelMorph</div>
          <div style={{ fontSize: 13, color: '#8E8E8E', marginTop: 2 }}>Crie sua conta gratuitamente</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome"
              style={inputStyle}
            />
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@email.com"
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                style={{ ...inputStyle, padding: '0 40px 0 12px' }}
              />
              <button
                onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={18} color="#8E8E8E" />
              </button>
            </div>
            {/* Strength bar */}
            {password.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 3 }}>
                {[1, 2, 3, 4].map(i => {
                  const strength = password.length < 6 ? 1 : password.length < 8 ? 2 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 3,
                        background: i <= strength
                          ? strength === 1 ? '#D25252'
                            : strength === 2 ? '#D2A05E'
                            : strength === 3 ? '#3A8FDE'
                            : '#5FB98F'
                          : '#3C3C3C',
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label style={labelStyle}>Confirmar senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repita a senha"
                style={{
                  ...inputStyle,
                  padding: '0 40px 0 12px',
                  border: `1px solid ${!passwordsMatch ? '#D25252' : '#3C3C3C'}`,
                }}
              />
              <button
                onClick={() => setShowConfirm(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <Icon name={showConfirm ? 'eyeOff' : 'eye'} size={18} color="#8E8E8E" />
              </button>
            </div>
            {!passwordsMatch && (
              <div style={{ fontSize: 11, color: '#D25252', marginTop: 4 }}>As senhas não coincidem</div>
            )}
          </div>

          {/* Terms */}
          <button
            onClick={() => setTerms(v => !v)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                flexShrink: 0,
                marginTop: 1,
                border: `1px solid ${terms ? '#3A8FDE' : '#3C3C3C'}`,
                background: terms ? '#3A8FDE' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {terms && <Icon name="check" size={12} color="#fff" />}
            </div>
            <span style={{ fontSize: 12, color: '#8E8E8E', lineHeight: 1.5 }}>
              Li e aceito os{' '}
              <span style={{ color: '#3A8FDE' }}>Termos de uso</span>
              {' '}e a{' '}
              <span style={{ color: '#3A8FDE' }}>Política de privacidade</span>
            </span>
          </button>

          {/* Submit */}
          <button
            onClick={() => { if (canSubmit) navigate('login'); }}
            style={{
              width: '100%',
              height: 44,
              background: canSubmit ? '#3A8FDE' : '#2F2F2F',
              color: canSubmit ? '#fff' : '#8E8E8E',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: canSubmit ? 'pointer' : 'default',
              borderRadius: 0,
              marginTop: 4,
            }}
          >
            Criar conta
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => navigate('login')}
              style={{ fontSize: 13, color: '#8E8E8E', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Já tenho conta.{' '}
              <span style={{ color: '#3A8FDE' }}>Entrar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
