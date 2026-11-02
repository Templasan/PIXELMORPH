import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppCompositionRoot } from '../CompositionRoot';
import { TopBar } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { useI18n } from '@core/i18n';
import { useStore } from '@core/state';
import { AUTH_FAILURE_TEXT, AuthFailure } from '@modules/account';

type Props = NativeStackScreenProps<RootStackParamList, 'NewPassword'>;

const { auth } = AppCompositionRoot.account;

/** Reached from a password reset link, or from "Alterar senha" / "Criar senha" while signed in. */
export default function NewPasswordScreen({ navigation }: Props) {
  const { t } = useI18n();
  const account = useStore(auth.state, (s) => s.account);
  // Read once: after saving, the account has a password, and the wording must not flip before the screen closes.
  const [creating] = useState(() => account !== null && !account.hasPassword);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = password.length >= 8 && password === confirm && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.updatePassword(password);
      navigation.reset({ index: 0, routes: [{ name: 'Projects' }] });
    } catch (e) {
      setError(t(AUTH_FAILURE_TEXT[e instanceof AuthFailure ? e.kind : 'unknown']));
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopBar
        title={t(creating ? 'Criar senha' : 'Nova senha')}
        onBackPress={() => navigation.navigate('Projects')}
      />
      <View style={styles.content}>
        <Text style={styles.label}>{t(creating ? 'Criar senha' : 'Nova senha')}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('Mínimo 8 caracteres')}
          placeholderTextColor={colors.texto2}
          secureTextEntry
          style={styles.input}
        />
        <Text style={styles.label}>{t('Confirmar senha')}</Text>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder={t('Repita a senha')}
          placeholderTextColor={colors.texto2}
          secureTextEntry
          style={styles.input}
        />
        {confirm !== '' && password !== confirm && (
          <Text style={styles.error}>{t('As senhas não coincidem')}</Text>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          style={[styles.button, !canSubmit && styles.buttonOff]}
          disabled={!canSubmit}
          onPress={submit}
        >
          <Text style={styles.buttonText}>{t(creating ? 'CRIAR SENHA' : 'SALVAR SENHA')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 24, gap: 8 },
  label: { fontSize: 11, color: colors.texto2, marginTop: 8 },
  input: {
    height: 40,
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
    paddingHorizontal: 12,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  error: { fontSize: fontSize.xs, color: colors.perigo },
  button: {
    height: 44,
    marginTop: 16,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: '#0D2036', fontSize: fontSize.sm, fontWeight: '600', letterSpacing: 1 },
});
