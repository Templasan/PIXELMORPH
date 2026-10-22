import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '@core/state';
import { colors } from '@core/theme';
import { tierInUse } from './EnginePreview';
import { previewSession, previewSettings, updatePreviewSettings } from './previewSettings';
import { TIER_SPECS, type TierSetting } from './previewTier';

const WEBVIEW_PACKAGE = 'com.google.android.webview';

/** Opens Android System WebView in the Play Store app, or on the web when there is no Play Store. */
export async function openWebViewUpdate() {
  try {
    await Linking.openURL(`market://details?id=${WEBVIEW_PACKAGE}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${WEBVIEW_PACKAGE}`);
  }
}

const QUALITIES: { value: TierSetting; label: string }[] = [
  { value: 'auto', label: 'Automática' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

/** Opened by tapping the quality badge: preview engine switch and "Qualidade da prévia". */
export function PreviewQualityMenu({ onClose }: { onClose: () => void }) {
  const settings = useStore(previewSettings);
  const inUse = useStore(tierInUse);
  const fallback = useStore(previewSession, (s) => s.fallback);
  const web = settings.engine === 'web';
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Prévia</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Motor</Text>
            <Pressable
              style={[styles.chip, !web && styles.chipOn]}
              onPress={() => updatePreviewSettings({ engine: 'native' })}
            >
              <Text style={styles.chipText}>Padrão</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, web && styles.chipOn]}
              onPress={() => updatePreviewSettings({ engine: 'web' })}
            >
              <Text style={styles.chipText}>Motor web</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            {web
              ? 'sem áudio na prévia (em breve)'
              : 'Prévia com áudio. O motor web (em teste) permite várias camadas.'}
          </Text>
          {fallback && (
            <Text style={styles.warn}>Motor web indisponível neste aparelho nesta sessão.</Text>
          )}
          <Text style={[styles.title, styles.gap]}>Qualidade da prévia</Text>
          <View style={styles.row}>
            {QUALITIES.map((q) => (
              <Pressable
                key={q.value}
                style={[styles.chip, settings.quality === q.value && styles.chipOn]}
                onPress={() => updatePreviewSettings({ quality: q.value })}
              >
                <Text style={styles.chipText}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>
            {web && inUse
              ? `Em uso: ${TIER_SPECS[inUse].label} (${TIER_SPECS[inUse].canvas.width}×${TIER_SPECS[inUse].canvas.height}). `
              : ''}
            Só muda a prévia; a exportação usa sempre os originais.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Non-blocking notices over the preview: the one-time fallback message and the step-down notice. */
export function PreviewNotices() {
  const fallback = useStore(previewSession, (s) => s.fallback);
  const shown = useStore(previewSession, (s) => s.fallbackShown);
  const notice = useStore(previewSession, (s) => s.notice);
  const engine = useStore(previewSettings, (s) => s.engine);
  const dismiss = () => previewSession.set((s) => ({ ...s, fallbackShown: true }));
  return (
    <>
      {engine === 'web' && fallback && !shown && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {fallback === 'webview'
              ? 'O motor de vídeo precisa do Android System WebView atualizado. Usando a prévia padrão.'
              : 'O motor de vídeo não iniciou neste aparelho. Usando a prévia padrão.'}
          </Text>
          <View style={styles.row}>
            {fallback === 'webview' && (
              <Pressable style={styles.chip} onPress={openWebViewUpdate}>
                <Text style={styles.chipText}>Atualizar o WebView na Play Store</Text>
              </Pressable>
            )}
            <Pressable style={styles.chip} onPress={dismiss}>
              <Text style={styles.chipText}>OK</Text>
            </Pressable>
          </View>
        </View>
      )}
      {notice && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.bannerText}>{notice}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.veu, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.painel, borderRadius: 10, padding: 16 },
  title: { color: colors.texto, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  gap: { marginTop: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  label: { color: colors.texto2, fontSize: 12, marginRight: 4 },
  chip: {
    backgroundColor: colors.linha,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipOn: { backgroundColor: colors.acento },
  chipText: { color: colors.branco, fontSize: 12 },
  hint: { color: colors.texto2, fontSize: 11, marginTop: 8 },
  warn: { color: colors.alerta, fontSize: 11, marginTop: 6 },
  banner: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: colors.veuForte,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  toast: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: colors.veuForte,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  bannerText: { color: colors.branco, fontSize: 12 },
});
