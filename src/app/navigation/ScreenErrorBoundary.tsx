import { Component, type ComponentType, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize } from '@core/theme';
import { t } from '@core/i18n';
import { errorLogger } from '@core/reliability';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from './RootNavigator';

interface Props {
  name: string;
  onLeave: () => void;
  children: ReactNode;
}

/**
 * A render error inside one screen shows a recovery panel instead of taking the whole app down.
 * Unmounting the failed subtree runs its effect cleanups, so pending history/autosave writes
 * are flushed (core/history DebouncedSaver). The error goes to the local log (RNF-017).
 */
export class ScreenErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    void errorLogger.log(error, `screen:${this.props.name}`);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('Algo deu errado nesta tela.')}</Text>
        <Text style={styles.body}>{t('Seu trabalho salvo não foi afetado.')}</Text>
        <Pressable style={styles.button} onPress={() => this.setState({ error: null })}>
          <Text style={styles.buttonText}>{t('Tentar novamente')}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={this.props.onLeave}>
          <Text style={styles.buttonText}>{t('Voltar')}</Text>
        </Pressable>
      </View>
    );
  }
}

/** Wraps a stack screen component in a ScreenErrorBoundary named after its route. */
export function withScreenBoundary<K extends keyof RootStackParamList>(
  Screen: ComponentType<NativeStackScreenProps<RootStackParamList, K>>,
  name: K
) {
  return function BoundedScreen(props: NativeStackScreenProps<RootStackParamList, K>) {
    const { navigation } = props;
    const leave = () =>
      navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Projects');
    return (
      <ScreenErrorBoundary name={name} onLeave={leave}>
        <Screen {...props} />
      </ScreenErrorBoundary>
    );
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: { color: colors.texto, fontSize: fontSize.lg, textAlign: 'center' },
  body: { color: colors.texto2, fontSize: fontSize.sm, textAlign: 'center' },
  button: { borderWidth: 1, borderColor: colors.linha, paddingVertical: 10, paddingHorizontal: 20 },
  buttonText: { color: colors.texto, fontSize: fontSize.sm },
});
