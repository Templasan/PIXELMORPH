import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore } from '@core/state';
import { errorLogger } from '@core/reliability';
import type { TierEnv, TierSetting } from './previewTier';

/** Persisted app settings of the video editor's preview. */
export interface PreviewSettings {
  quality: TierSetting;
}

const KEY = 'pixelmorph.videoPreviewSettings';
const DEFAULTS: PreviewSettings = { quality: 'auto' };

export const previewSettings = createStore<PreviewSettings>(DEFAULTS);

let loaded: Promise<void> | null = null;

/** Reads the saved settings once per app run. */
export function loadPreviewSettings(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      const p = JSON.parse(raw) as Partial<PreviewSettings>;
      previewSettings.set({
        quality:
          p.quality === 'alta' || p.quality === 'media' || p.quality === 'baixa'
            ? p.quality
            : 'auto',
      });
    })
    .catch((error) => errorLogger.log(error, 'previewSettings.load'));
  return loaded;
}

export function updatePreviewSettings(patch: Partial<PreviewSettings>) {
  previewSettings.set((s) => ({ ...s, ...patch }));
  AsyncStorage.setItem(KEY, JSON.stringify(previewSettings.get())).catch((error) =>
    errorLogger.log(error, 'previewSettings.save')
  );
}

/** What happened to the web engine during this app run (not persisted). */
export interface PreviewSession {
  /** Why the editor fell back to the native preview for this session. */
  fallback: null | 'webview' | 'error';
  /** The banner explaining the fallback was already shown once. */
  fallbackShown: boolean;
  env: TierEnv | null;
  /** The automatic step down happened (once per session). */
  steppedDown: boolean;
  notice: string | null;
}

export const previewSession = createStore<PreviewSession>({
  fallback: null,
  fallbackShown: false,
  env: null,
  steppedDown: false,
  notice: null,
});

export const patchPreviewSession = (patch: Partial<PreviewSession>) =>
  previewSession.set((s) => ({ ...s, ...patch }));
