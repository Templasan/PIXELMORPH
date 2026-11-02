import { createStore } from '@core/state';

/**
 * Web design preview only (docs/web-preview.md): what the preview's side panel controls. Nothing
 * here reaches the Android app: only `.web` files import it.
 */
export type PreviewSyncResult = 'ok' | 'sent' | 'conflict' | 'offline';

export const previewState = createStore({
  syncResult: 'ok' as PreviewSyncResult,
  width: 412,
});

export const PREVIEW_ACCOUNTS = {
  password: {
    id: 'preview-1',
    name: 'Conta de Exemplo',
    email: 'exemplo@example.com',
    hasPassword: true,
  },
  google: {
    id: 'preview-2',
    name: 'Conta Google',
    email: 'google@example.com',
    hasPassword: false,
  },
};

export interface PreviewAlert {
  title: string;
  message?: string;
  buttons: { text: string; style?: string; onPress?: () => void }[];
}

/** React Native Web's Alert does nothing, so the preview draws its own. */
export const previewAlert = createStore<PreviewAlert | null>(null);
