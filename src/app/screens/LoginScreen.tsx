import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const CODE_LENGTH = 6;

export default function LoginScreen({ navigation }: Props) {
  const [step, setStep] = useState<'login' | '2fa'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(''));
  // TODO: real countdown timer + resend-code request. Static per the prototype's example data.
  const [timer] = useState(42);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleLogin = () => {
    // TODO: call real authentication API; currently jumps straight to the 2FA step.
    setStep('2fa');
  };

  const handleCodeChange = (i: number, val: string) => {
    const digit = val.replace(/[^0-9]/g, '').slice(-1);
    const next = [...code];
    next[i] = digit;
    setCode(next);
    if (digit && i < CODE_LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const handleKeyPress = (i: number, key: string) => {
    if (key === 'Backspace' && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handleVerify = () => {
    // TODO: validate the 6-digit code against the backend before granting access.
    navigation.reset({ index: 0, routes: [{ name: 'Projects' }] });
  };

  if (step === '2fa') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerColumn}>
          <View style={styles.shieldBox}>
            <Icon name="shield" size={32} color={colors.acento} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.stepTitle}>Verificação em duas etapas</Text>
            <Text style={styles.stepSubtitle}>Digite o código enviado para seu e-mail</Text>
          </View>
          <View style={styles.codeRow}>
            {code.map((v, i) => (
              <TextInput
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={v}
                onChangeText={(t) => handleCodeChange(i, t)}
                onKeyPress={(e) => handleKeyPress(i, e.nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                style={[styles.codeBox, v ? styles.codeBoxFilled : null]}
              />
            ))}
          </View>
          <Text style={styles.timerText}>
            Reenviar código em{' '}
            <Text style={styles.timerValue}>00:{String(timer).padStart(2, '0')}</Text>
          </Text>
          <Pressable style={styles.primaryButton} onPress={handleVerify}>
            <Text style={styles.primaryButtonText}>VERIFICAR</Text>
          </Pressable>
          <Pressable>
            <Text style={styles.linkText}>Usar app autenticador</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.centerColumn}>
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.logo}>PixelMorph</Text>
              <Text style={styles.tagline}>Editor de foto e vídeo</Text>
            </View>

            <View style={{ gap: 16 }}>
              <View>
                <Text style={styles.fieldLabel}>E-MAIL</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="usuario@email.com"
                  placeholderTextColor={colors.texto2}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>SENHA</Text>
                <View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.texto2}
                    secureTextEntry={!showPw}
                    style={[styles.input, { paddingRight: 40 }]}
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowPw(!showPw)}
                    hitSlop={8}
                  >
                    <Icon name={showPw ? 'eyeOff' : 'eye'} size={18} color={colors.texto2} />
                  </Pressable>
                </View>
              </View>
              <Pressable>
                <Text style={styles.linkText}>Esqueci minha senha</Text>
              </Pressable>
            </View>

            <Pressable style={styles.primaryButton} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>ENTRAR</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.secondaryButtonText}>CRIAR CONTA</Text>
            </Pressable>
          </View>

          <View style={styles.langRow}>
            {(['PT', 'EN', 'ES'] as const).map((lang) => (
              // TODO: wire up real i18n / locale switching.
              <Pressable key={lang}>
                <Text style={[styles.langText, lang === 'PT' && styles.langTextActive]}>
                  {lang}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  centerColumn: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 24,
    alignItems: 'stretch',
  },
  logo: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.texto,
  },
  tagline: {
    fontSize: fontSize.sm,
    color: colors.texto2,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.texto2,
    marginBottom: 6,
  },
  input: {
    height: 40,
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
    paddingHorizontal: 12,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  eyeButton: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: fontSize.xs,
    color: colors.acento,
    alignSelf: 'flex-start',
  },
  primaryButton: {
    height: 44,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#0D2036',
    fontSize: fontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
  },
  secondaryButton: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.texto,
    fontSize: fontSize.sm,
    letterSpacing: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.linha,
  },
  dividerText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 16,
  },
  langText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  langTextActive: {
    color: colors.texto,
  },
  shieldBox: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  stepTitle: {
    fontSize: fontSize.lg,
    fontWeight: '500',
    color: colors.texto,
  },
  stepSubtitle: {
    fontSize: fontSize.sm,
    color: colors.texto2,
    marginTop: 4,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  codeBox: {
    width: 48,
    height: 48,
    textAlign: 'center',
    fontSize: fontSize.xl,
    fontFamily: monoFontFamily,
    color: colors.texto,
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  codeBoxFilled: {
    borderColor: colors.acento,
  },
  timerText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    textAlign: 'center',
  },
  timerValue: {
    fontFamily: monoFontFamily,
    color: colors.texto,
  },
});
