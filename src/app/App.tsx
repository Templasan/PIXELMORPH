import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';
import { colors } from '@core/theme';
import { errorLogger } from '@core/reliability';
import { initLanguage } from '@core/i18n';

// RNF-017: capture uncaught JS errors into the local rotating log as early as possible.
errorLogger.installGlobalHandler();

const pixelMorphNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.canvas,
    card: colors.barra,
    border: colors.linha,
    primary: colors.acento,
    text: colors.texto,
  },
};

export default function App() {
  // RNF-016: restore the language the user picked last time.
  useEffect(() => {
    initLanguage();
    // RNF-017: send any not-yet-reported errors (no-op without consent or an HTTPS endpoint).
    errorLogger.reportPending();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={pixelMorphNavigationTheme}>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
