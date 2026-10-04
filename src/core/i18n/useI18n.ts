import { useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LANGUAGES,
  getLanguage,
  getLanguageVersion,
  setLanguage,
  subscribeLanguage,
  t,
  type LanguageCode,
} from './i18n';

const LANGUAGE_KEY = 'pixelmorph.language';

/** Restores the saved language at startup; call once before the first screen renders. */
export async function initLanguage(): Promise<void> {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY).catch(() => null);
  if (LANGUAGES.some((l) => l.code === saved)) await setLanguage(saved as LanguageCode);
}

/** Re-renders the calling component whenever the language changes; `t` is stable. */
export function useI18n() {
  useSyncExternalStore(subscribeLanguage, getLanguageVersion);
  const changeLanguage = useCallback(async (code: LanguageCode) => {
    await setLanguage(code);
    await AsyncStorage.setItem(LANGUAGE_KEY, code).catch(() => undefined);
  }, []);
  return { t, language: getLanguage(), changeLanguage };
}
