import { useEffect, useState } from 'react';
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
import { AppCompositionRoot } from '../CompositionRoot';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { LANGUAGES, useI18n } from '@core/i18n';
import { useStore } from '@core/state';
import { AUTH_FAILURE_TEXT, AuthFailure } from '@modules/account';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const { auth } = AppCompositionRoot.account;

export default function LoginScreen({ navigation }: Props) {
  const { t, language, changeLanguage } = useI18n();
  const status = useStore(auth.state, (s) => s.status);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  useEffect(() => {
    if (status === 'signedIn') navigation.reset({ index: 0, routes: [{ name: 'Projects' }] });
  }, [status, navigation]);

  const attempt = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMessage(null);
    setUnconfirmed(false);
    try {
      await action();
      if (done) setMessage(t(done));
    } catch (e) {
      const kind = e instanceof AuthFailure ? e.kind : 'unknown';
      setMessage(t(AUTH_FAILURE_TEXT[kind]));
      setUnconfirmed(kind === 'emailNotConfirmed');
    }
    setBusy(false);
  };

  const canSignIn = email.trim() !== '' && password !== '' && !busy;

  const handleForgot = () => {
    if (!email.trim()) {
      setMessage(t('Digite seu e-mail acima para receber o link.'));
      return;
    }
    void attempt(() => auth.sendPasswordReset(email), 'Enviamos um link para redefinir sua senha.');
  };

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
              <Text style={styles.tagline}>{t('Editor de foto e vídeo')}</Text>
            </View>

            <View style={{ gap: 16 }}>
              <View>
                <Text style={styles.fieldLabel}>{t('E-MAIL')}</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="usuario@email.com"
                  placeholderTextColor={colors.texto2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>{t('SENHA')}</Text>
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
              <Pressable onPress={handleForgot} disabled={busy}>
                <Text style={styles.linkText}>{t('Esqueci minha senha')}</Text>
              </Pressable>
            </View>

            {message && <Text style={styles.message}>{message}</Text>}
            {unconfirmed && (
              <Pressable
                disabled={busy}
                onPress={() =>
                  void attempt(
                    () => auth.resendConfirmation(email),
                    'Enviamos um novo link de confirmação.'
                  )
                }
              >
                <Text style={styles.linkText}>{t('Reenviar e-mail de confirmação')}</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.primaryButton, !canSignIn && styles.buttonOff]}
              disabled={!canSignIn}
              onPress={() => void attempt(() => auth.signIn(email, password))}
            >
              <Text style={styles.primaryButtonText}>{t('ENTRAR')}</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('ou')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={styles.secondaryButton}
              disabled={busy}
              onPress={() => void attempt(() => auth.signInWithGoogle())}
            >
              <Text style={styles.secondaryButtonText}>{t('CONTINUAR COM GOOGLE')}</Text>
            </Pressable>
            {/* Plain text on purpose: the Termos de uso and Política de privacidade documents are
                pending, so there is nothing to link to yet. Add links when they exist. */}
            <Text style={styles.termsNote}>
              {t('Ao continuar, você aceita os Termos de uso e a Política de privacidade.')}
            </Text>

            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.secondaryButtonText}>{t('CRIAR CONTA')}</Text>
            </Pressable>

            <Pressable style={styles.skip} onPress={() => navigation.navigate('Projects')}>
              <Text style={styles.linkText}>{t('Agora não')}</Text>
            </Pressable>
          </View>

          <View style={styles.langRow}>
            {LANGUAGES.map((l) => (
              <Pressable key={l.code} onPress={() => changeLanguage(l.code)}>
                <Text style={[styles.langText, l.code === language && styles.langTextActive]}>
                  {l.code.toUpperCase()}
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
  termsNote: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    lineHeight: 18,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  buttonOff: {
    opacity: 0.4,
  },
  skip: {
    alignSelf: 'center',
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
});
