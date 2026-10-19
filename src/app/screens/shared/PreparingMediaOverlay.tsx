import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@core/i18n';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';

/** Blocks an editor until its media has a light preview copy. Back stays usable; the job keeps running. */
export function PreparingMediaOverlay({
  progress,
  onBack,
}: {
  progress: number;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('Voltar')}
        style={[styles.back, { top: insets.top + 12, left: insets.left + 12 }]}
      >
        <Icon name="chevronLeft" size={20} />
      </Pressable>
      <View style={[styles.center, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.acento} />
        <Text style={styles.title}>{t('Preparando mídia para edição…')}</Text>
        {progress > 0 && <Text style={styles.percent}>{Math.round(progress)}%</Text>}
        <Text style={styles.hint}>
          {t('Arquivos grandes levam alguns segundos na primeira vez.')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.canvas,
    zIndex: 10,
    elevation: 10,
  },
  back: {
    position: 'absolute',
    padding: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: fontSize.lg,
    color: colors.texto,
    textAlign: 'center',
  },
  percent: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.md,
    color: colors.texto2,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.texto2,
    textAlign: 'center',
  },
});
