import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppModules } from '../hooks/useAppModules';
import { useI18n } from '@core/i18n';
import { errorLogger } from '@core/reliability';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { createMediaAsset, createMediaMetadata } from '@modules/projects';

type Props = NativeStackScreenProps<RootStackParamList, 'Tutorials'>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SAMPLE = require('../../../assets/tutorial-sample.jpg');
const SAMPLE_SIZE = { width: 1600, height: 1200 };

/** RF-056: each one opens a sample photo in the editor, which guides the steps (photo-editor-web). */
const TUTORIALS = [
  {
    id: 'ajustes',
    icon: 'sliders',
    title: 'Primeiros ajustes',
    detail: 'Mude a foto e compare com o original.',
  },
  {
    id: 'camadas',
    icon: 'layers',
    title: 'Texto e camadas',
    detail: 'Escreva sobre a foto e controle a camada.',
  },
  {
    id: 'mascaras',
    icon: 'sun',
    title: 'Foco seletivo',
    detail: 'Desfoque o fundo com uma máscara.',
  },
] as const;

export default function TutorialsScreen({ navigation }: Props) {
  const { t } = useI18n();
  const { projects } = useAppModules();
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (id: string, title: string) => {
    setOpening(id);
    try {
      const asset = await Asset.fromModule(SAMPLE).downloadAsync();
      if (!asset.localUri) throw new Error('sample photo not available');
      const project = await projects.createProjectWithMedia.execute(t(title), 'photo', [
        createMediaAsset(
          `asset_${Date.now()}`,
          'image',
          asset.localUri,
          asset.localUri,
          createMediaMetadata('image/jpeg', SAMPLE_SIZE)
        ),
      ]);
      navigation.navigate('PhotoEditor', { projectId: project.id, start: `tutorial:${id}` });
    } catch (error) {
      errorLogger.log(error, 'TutorialsScreen.open');
      Alert.alert(t('Não foi possível abrir o tutorial'), t('Tente novamente.'));
    } finally {
      setOpening(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('Voltar')}
        >
          <Icon name="back" size={22} color={colors.texto} />
        </Pressable>
        <Text style={styles.title}>{t('Tutoriais')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.intro}>
          {t(
            'Cada tutorial abre uma foto de exemplo e guia você passo a passo. Pode sair quando quiser.'
          )}
        </Text>
        {TUTORIALS.map((item) => (
          <Pressable
            key={item.id}
            style={styles.card}
            disabled={opening !== null}
            onPress={() => open(item.id, item.title)}
            accessibilityRole="button"
            accessibilityLabel={t(item.title)}
          >
            <Icon name={item.icon} size={24} color={colors.texto} />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{t(item.title)}</Text>
              <Text style={styles.cardDetail}>{t(item.detail)}</Text>
            </View>
            {opening === item.id && <ActivityIndicator color={colors.texto} />}
          </Pressable>
        ))}
      </ScrollView>
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
  back: {
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
  list: {
    padding: 16,
    gap: 12,
  },
  intro: {
    color: colors.texto2,
    marginBottom: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.barra,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    color: colors.texto,
    fontWeight: '600',
  },
  cardDetail: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
});
