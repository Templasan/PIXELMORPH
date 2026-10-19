import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '@core/state';
import { useI18n } from '@core/i18n';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { proxyStore } from './previewProxy';

/** Progress of the proxy transcodes still pending or running (0 for a queued one), or null when none. */
function activeProxyProgress(state: Record<string, { status: string; progress: number }>) {
  let active = false;
  let progress = 0;
  for (const entry of Object.values(state)) {
    if (entry.status === 'pending' || entry.status === 'running') active = true;
    if (entry.status === 'running') progress = entry.progress;
  }
  return active ? progress : null;
}

/** Small note over the preview while a light preview is being made for heavy videos. */
export function PreviewProxyLabel() {
  const { t } = useI18n();
  const progress = useStore(proxyStore, activeProxyProgress);
  if (progress === null) return null;
  return (
    <View pointerEvents="none" style={styles.label}>
      <Text style={styles.text}>
        {t('Preparando prévia leve… {p}%', { p: Math.round(progress) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    top: 36,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  text: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
});
