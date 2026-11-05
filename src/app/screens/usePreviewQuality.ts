import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** The preview quality the person picked: a tier, or 'auto' (the phone decides). */
export type QualitySetting = 'auto' | 'alta' | 'media' | 'baixa';

const QUALITY_KEY = 'pixelmorph.previewQuality';
const SETTINGS: readonly string[] = ['auto', 'alta', 'media', 'baixa'];

/** Anything unknown, or never saved, is 'auto'. */
export function parseQualitySetting(raw: unknown): QualitySetting {
  return SETTINGS.includes(raw as string) ? (raw as QualitySetting) : 'auto';
}

/**
 * The saved preview quality. `quality` stays null until it is read, so a WebView never starts
 * on a guess; `setQuality` saves it.
 */
export function usePreviewQuality() {
  const [quality, setQualityState] = useState<QualitySetting | null>(null);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(QUALITY_KEY)
      .catch(() => null)
      .then((saved) => {
        if (alive) setQualityState(parseQualitySetting(saved));
      });
    return () => {
      alive = false;
    };
  }, []);
  const setQuality = useCallback(async (setting: QualitySetting) => {
    setQualityState(setting);
    await AsyncStorage.setItem(QUALITY_KEY, setting).catch(() => undefined);
  }, []);
  return { quality, setQuality };
}
