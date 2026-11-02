import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { MainBar } from '../navigation/MainBar';
import { Icon } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { useI18n } from '@core/i18n';
import { errorLogger } from '@core/reliability';
import { createPhotoEditorModule } from '@modules/photo-editor';
import { useAppModules } from '../hooks';
import { RawImportSheet } from './projects/RawImportSheet';
import { timelineHasClips } from './video-editor/timelineFile';

type Props = NativeStackScreenProps<RootStackParamList, 'Explore'>;

interface SavedPreset {
  id: string;
  name: string;
  fields: number;
}

/** The hub for what is not a project: tools now; downloads and posts when the community exists. */
export default function ExploreScreen({ navigation }: Props) {
  const { t } = useI18n();
  const { projects } = useAppModules();
  const startedTimelapse = useRef<string | null>(null);
  const [rawImportOpen, setRawImportOpen] = useState(false);
  const [presets, setPresets] = useState<SavedPreset[]>([]);

  useFocusEffect(
    useCallback(() => {
      const started = startedTimelapse.current;
      if (started) {
        startedTimelapse.current = null;
        void timelineHasClips(started).then((used) => {
          if (!used) return projects.deleteProject.execute(started);
          return undefined;
        });
      }
    }, [projects])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      createPhotoEditorModule()
        .listPresets.execute()
        .then((all) => {
          if (cancelled) return;
          setPresets(
            all.map((p) => ({
              id: p.id,
              name: p.name,
              fields: Object.keys(p.adjustments).length,
            }))
          );
        })
        .catch((error) => errorLogger.log(error, 'ExploreScreen.presets'));
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // A time-lapse is a video project from its first step, so its work is saved like any other.
  const startTimelapse = async () => {
    try {
      const project = await projects.createProject.execute(t('Time-lapse'), 'video');
      startedTimelapse.current = project.id;
      navigation.navigate('VideoEditor', { projectId: project.id, start: 'timelapse' });
    } catch (error) {
      errorLogger.log(error, 'ExploreScreen.startTimelapse');
      Alert.alert(t('Não foi possível criar'), t('Tente novamente.'));
    }
  };

  const tools = [
    {
      name: t('Conversor RAW'),
      detail: 'CR3, NEF, ARW, DNG',
      icon: 'upload',
      onPress: () => setRawImportOpen(true),
    },
    {
      name: t('Colagem'),
      detail: t('Juntar várias fotos'),
      icon: 'grid',
      onPress: () => navigation.navigate('PhotoEditor', { start: 'collage' }),
    },
    {
      name: t('Panorama'),
      detail: t('Emendar uma sequência'),
      icon: 'maximize',
      onPress: () => navigation.navigate('PhotoEditor', { start: 'panorama' }),
    },
    {
      name: t('Time-lapse'),
      detail: t('Vídeo a partir de fotos'),
      icon: 'clock',
      onPress: () => void startTimelapse(),
    },
    {
      name: t('Presets'),
      detail: t('Ajustes prontos'),
      icon: 'star',
      onPress: () => navigation.navigate('Presets'),
    },
    {
      name: t('Tutoriais'),
      detail: t('Aprender fazendo'),
      icon: 'bookOpen',
      onPress: () => navigation.navigate('Tutorials'),
    },
    {
      name: t('Armazenamento'),
      detail: t('Ver e liberar espaço'),
      icon: 'save',
      onPress: () => navigation.navigate('Storage'),
    },
    {
      name: t('Ajuda'),
      detail: t('Dúvidas e suporte'),
      icon: 'help',
      onPress: () => navigation.navigate('Help'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{t('Explorar')}</Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.pageEnd}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('Ferramentas')}</Text>
          <View style={styles.tools}>
            {tools.map((tool) => (
              <View key={tool.name} style={styles.toolCell}>
                <Pressable style={styles.tool} onPress={tool.onPress}>
                  <Icon name={tool.icon} size={22} />
                  <Text style={styles.toolName}>{tool.name}</Text>
                  <Text style={styles.toolDetail}>{tool.detail}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('Seus presets')}</Text>
          {presets.length > 0 ? (
            <FlatList
              horizontal
              data={presets}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetRail}
              renderItem={({ item }) => (
                <View style={styles.preset}>
                  <Icon name="sliders" size={22} color={colors.texto2} />
                  <Text style={styles.presetName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.toolDetail}>{t('{n} ajustes', { n: item.fields })}</Text>
                </View>
              )}
            />
          ) : (
            <Text style={styles.empty}>
              {t('Os presets que você salvar no editor de fotos aparecem aqui.')}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('Comunidade')}</Text>
          <View style={styles.soon}>
            <Icon name="users" size={26} color={colors.texto2} />
            <Text style={styles.soonTitle}>{t('Em breve')}</Text>
            <Text style={styles.soonText}>
              {t('Baixar presets e filtros e ver postagens de outras pessoas.')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <MainBar active="Explore" />

      {rawImportOpen && (
        <RawImportSheet
          onClose={() => setRawImportOpen(false)}
          onConfirm={(result) => {
            setRawImportOpen(false);
            navigation.navigate('RawConverter', result);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topBar: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.texto,
  },
  // The camera button rises over the end of the page.
  pageEnd: {
    paddingBottom: 32,
  },
  body: {
    flex: 1,
  },
  section: {
    marginTop: 4,
    marginBottom: 22,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '700',
    color: colors.texto,
  },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  toolCell: {
    width: '50%',
    padding: 4,
  },
  tool: {
    minHeight: 96,
    padding: 12,
    gap: 6,
    borderRadius: 10,
    backgroundColor: colors.barra,
  },
  toolName: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.texto,
  },
  toolDetail: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  presetRail: {
    gap: 8,
    paddingHorizontal: 16,
  },
  preset: {
    width: 124,
    minHeight: 112,
    padding: 12,
    gap: 6,
    borderRadius: 10,
    backgroundColor: colors.barra,
  },
  presetName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.texto,
  },
  empty: {
    paddingHorizontal: 16,
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  soon: {
    marginHorizontal: 16,
    padding: 20,
    gap: 6,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  soonTitle: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.texto,
  },
  soonText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    color: colors.texto2,
  },
});
