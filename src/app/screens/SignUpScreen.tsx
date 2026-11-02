import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppCompositionRoot } from '../CompositionRoot';
import { Icon, TopBar } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { useI18n } from '@core/i18n';
import { useStore } from '@core/state';
import { AUTH_FAILURE_TEXT, AuthFailure } from '@modules/account';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

const { auth } = AppCompositionRoot.account;

function passwordStrength(password: string): 1 | 2 | 3 | 4 {
  if (password.length < 6) return 1;
  if (password.length < 8) return 2;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return 4;
  return 3;
}

const strengthColor: Record<1 | 2 | 3 | 4, string> = {
  1: colors.perigo,
  2: colors.alerta,
  3: colors.acento,
  4: colors.ok,
};

export default function SignUpScreen({ navigation }: Props) {
  const { t } = useI18n();
  const status = useStore(auth.state, (s) => s.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [terms, setTerms] = useState(false);

  const passwordsMatch = confirm === '' || password === confirm;
  const canSubmit = Boolean(
    name.trim() && email.trim() && password.length >= 8 && password === confirm && terms && !busy
  );
  const strength = passwordStrength(password);

  // The confirmation link signs the account in, wherever the user is waiting.
  useEffect(() => {
    if (status === 'signedIn') navigation.reset({ index: 0, routes: [{ name: 'Projects' }] });
  }, [status, navigation]);

  const attempt = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(t(AUTH_FAILURE_TEXT[e instanceof AuthFailure ? e.kind : 'unknown']));
    }
    setBusy(false);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    void attempt(async () => {
      setSent(await auth.signUp(name, email, password));
    });
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <TopBar title={t('Confirme seu e-mail')} onBackPress={() => navigation.navigate('Login')} />
        <View style={styles.content}>
          <Text style={styles.tagline}>
            {t('Enviamos um link de confirmação para')} {email.trim()}.{' '}
            {t(
              'Abra o link neste aparelho, ou confirme em qualquer lugar e depois entre com sua senha.'
            )}
          </Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Pressable
            style={[styles.submitButton, { marginTop: 24 }]}
            disabled={busy}
            onPress={() => void attempt(() => auth.resendConfirmation(email))}
          >
            <Text style={styles.submitText}>{t('REENVIAR E-MAIL')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopBar title={t('Criar conta')} onBackPress={() => navigation.navigate('Login')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.logo}>PixelMorph</Text>
          <Text style={styles.tagline}>{t('Crie sua conta gratuitamente')}</Text>
        </View>

        <View style={{ gap: 16 }}>
          <View>
            <Text style={styles.fieldLabel}>{t('Nome completo')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('Seu nome')}
              placeholderTextColor={colors.texto2}
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.fieldLabel}>{t('E-mail')}</Text>
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
            <Text style={styles.fieldLabel}>{t('Senha')}</Text>
            <View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('Mínimo 8 caracteres')}
                placeholderTextColor={colors.texto2}
                secureTextEntry={!showPw}
                style={[styles.input, { paddingRight: 40 }]}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={18} color={colors.texto2} />
              </Pressable>
            </View>
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: i <= strength ? strengthColor[strength] : colors.linha },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          <View>
            <Text style={styles.fieldLabel}>{t('Confirmar senha')}</Text>
            <View>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder={t('Repita a senha')}
                placeholderTextColor={colors.texto2}
                secureTextEntry={!showConfirm}
                style={[
                  styles.input,
                  { paddingRight: 40 },
                  !passwordsMatch && { borderColor: colors.perigo },
                ]}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={8}
              >
                <Icon name={showConfirm ? 'eyeOff' : 'eye'} size={18} color={colors.texto2} />
              </Pressable>
            </View>
            {!passwordsMatch && (
              <Text style={styles.errorText}>{t('As senhas não coincidem')}</Text>
            )}
          </View>

          <Pressable style={styles.termsRow} onPress={() => setTerms((v) => !v)}>
            <View style={[styles.checkbox, terms && styles.checkboxChecked]}>
              {terms && <Icon name="check" size={12} color={colors.branco} />}
            </View>
            <Text style={styles.termsText}>
              {t('Li e aceito os')} <Text style={styles.termsLink}>{t('Termos de uso')}</Text>{' '}
              {t('e a')} <Text style={styles.termsLink}>{t('Política de privacidade')}</Text>
            </Text>
          </Pressable>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.submitButton, canSubmit && styles.submitButtonEnabled]}
            onPress={handleSubmit}
          >
            <Text style={[styles.submitText, canSubmit && styles.submitTextEnabled]}>
              {t('CRIAR CONTA')}
            </Text>
          </Pressable>

          <Pressable style={{ alignItems: 'center' }} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginHint}>
              {t('Já tenho conta.')} <Text style={styles.termsLink}>{t('Entrar')}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: 24,
    paddingBottom: 32,
  },
  logo: {
    fontSize: fontSize.xl,
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
  strengthRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 6,
  },
  strengthBar: {
    flex: 1,
    height: 3,
  },
  errorText: {
    fontSize: 11,
    color: colors.perigo,
    marginTop: 4,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    marginTop: 1,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.acento,
    backgroundColor: colors.acento,
  },
  termsText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.texto2,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.acento,
  },
  submitButton: {
    height: 44,
    backgroundColor: colors.painel,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonEnabled: {
    backgroundColor: colors.acento,
  },
  submitText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.texto2,
  },
  submitTextEnabled: {
    color: colors.branco,
  },
  loginHint: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
});
