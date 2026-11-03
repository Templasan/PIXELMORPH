import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useI18n } from '@core/i18n';
import { errorLogger } from '@core/reliability';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { createPhotoEditorModule, type Preset } from '@modules/photo-editor';

type Props = NativeStackScreenProps<RootStackParamList, 'Presets'>;

/** RF-014: the presets saved in the photo editor. They are applied from there, on a photo. */
export default function PresetsScreen({ navigation }: Props) {
  const { t } = useI18n();
  const [presets, setPresets] = useState<Preset[] | null>(null);

  const load = useCallback(() => {
    createPhotoEditorModule()
      .listPresets.execute()
      .then(setPresets)
      .catch((error) => {
        errorLogger.log(error, 'PresetsScreen.load');
        setPresets([]);
      });
  }, []);
  useFocusEffect(load);

  const remove = (preset: Preset) =>
    Alert.alert(t('Excluir preset?'), preset.name, [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Excluir'),
        style: 'destructive',
        onPress: () => {
          createPhotoEditorModule()
            .deletePreset.execute(preset.id)
            .then(load)
            .catch((error) => errorLogger.log(error, 'PresetsScreen.remove'));
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('Voltar')}
        >
          <Icon name="back" size={22} color={colors.texto} />
        </Pressable>
        <Text style={styles.title}>{t('Presets')}</Text>
      </View>
      {presets?.length === 0 ? (
        <Text style={styles.empty}>
          {t('Os presets que você salvar no editor de fotos aparecem aqui.')}
        </Text>
      ) : (
        <FlatList
          data={presets ?? []}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Icon name="sliders" size={22} color={colors.texto2} />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.detail}>
                  {t('{n} ajustes', { n: Object.keys(item.adjustments).length })}
                </Text>
              </View>
              <Pressable
                onPress={() => remove(item)}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={t('Excluir preset {name}', { name: item.name })}
              >
                <Icon name="trash" size={20} color={colors.texto2} />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.texto,
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    color: colors.texto2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingLeft: 16,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  rowText: {
    flex: 1,
  },
  name: {
    color: colors.texto,
    fontWeight: '600',
  },
  detail: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
});
