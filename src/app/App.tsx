import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  createNavigationContainerRef,
  DarkTheme,
  NavigationContainer,
  Theme,
} from '@react-navigation/native';
import RootNavigator, { type RootStackParamList } from './navigation/RootNavigator';
import { AppCompositionRoot } from './CompositionRoot';
import { colors } from '@core/theme';
import { errorLogger } from '@core/reliability';
import { initLanguage, t } from '@core/i18n';
import { useStore } from '@core/state';
import { AUTH_FAILURE_TEXT } from '@modules/account';

// RNF-017: capture uncaught JS errors into the local rotating log as early as possible.
errorLogger.installGlobalHandler();

const { auth } = AppCompositionRoot.account;
const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
  const [navReady, setNavReady] = useState(false);
  const authStatus = useStore(auth.state, (s) => s.status);
  const linkFailure = useStore(auth.state, (s) => s.linkFailure);
  // RNF-016: restore the language the user picked last time.
  useEffect(() => {
    initLanguage();
    auth.start();
    // RNF-017: send any not-yet-reported errors (no-op without consent or an HTTPS endpoint).
    errorLogger.reportPending();
  }, []);

  // E-mail links can arrive on any screen, or open the app.
  useEffect(() => {
    if (navReady && authStatus === 'recovery') navigationRef.navigate('NewPassword');
  }, [navReady, authStatus]);
  useEffect(() => {
    if (!linkFailure) return;
    Alert.alert('PixelMorph', t(AUTH_FAILURE_TEXT[linkFailure]));
    auth.state.set((prev) => ({ ...prev, linkFailure: null }));
  }, [linkFailure]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={pixelMorphNavigationTheme}
          onReady={() => setNavReady(true)}
        >
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
