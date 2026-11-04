import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { t } from '@core/i18n';

/** Dying again this soon means reopening will not help, and it must not loop. */
const GIVE_UP_WITHIN_MS = 30_000;

/** True when a second loss came too soon after the last one to try again. */
export function shouldGiveUp(lastLossAt: number | null, now: number): boolean {
  return lastLossAt !== null && now - lastLossAt < GIVE_UP_WITHIN_MS;
}

/**
 * The system can kill a WebView's page, usually for memory, and that page cannot come back by
 * itself: a new key builds a new WebView, which loads the project from what was saved.
 */
export function useEditorRecovery(leave: () => void) {
  const [editorKey, setEditorKey] = useState(0);
  const lastLossAt = useRef<number | null>(null);
  const onRenderProcessGone = useCallback(() => {
    const now = Date.now();
    if (shouldGiveUp(lastLossAt.current, now)) {
      Alert.alert(
        t('O editor fechou de novo'),
        t('Este aparelho ficou sem memória. Feche outros apps e abra o projeto novamente.')
      );
      leave();
      return;
    }
    lastLossAt.current = now;
    setEditorKey((key) => key + 1);
    Alert.alert(
      t('O editor foi reaberto'),
      t(
        'O sistema fechou o editor, geralmente por falta de memória. A última alteração pode não ter sido salva.'
      )
    );
  }, [leave]);
  return { editorKey, onRenderProcessGone };
}
