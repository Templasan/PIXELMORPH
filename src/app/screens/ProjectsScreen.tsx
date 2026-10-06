import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon } from '@core/ui';
import { SideDrawer } from '../navigation/SideDrawer';
import { colors, fontSize } from '@core/theme';
import { useI18n } from '@core/i18n';
import {
  createMediaAsset,
  createMediaMetadata,
  type Project,
  type ProjectPriority,
} from '@modules/projects';
import { useAppModules } from '../hooks';
import { pickFromGallery, probeVideoDurationMs } from '@modules/device-media';
import { errorLogger } from '@core/reliability';
import { RawImportSheet } from './projects/RawImportSheet';
import { ProjectCard } from './projects/ProjectCard';
import { ReminderBanner } from './projects/ReminderBanner';
import { ProjectInfoSheet } from './projects/ProjectInfoSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'Projects'>;

const TABS = ['TODOS', 'FOTOS', 'VÍDEOS', 'RASCUNHOS'] as const;
type Tab = (typeof TABS)[number];

/** True when a project has never produced a final export — used for the RASCUNHOS tab. */
function isDraft(project: Project): boolean {
  return !project.thumbnailUri;
}

// Once per app session: copy media older projects still reference in the cache to permanent
// storage (see repairCacheMedia).
let mediaRepair: Promise<unknown> | null = null;

export default function ProjectsScreen({ navigation }: Props) {
  // Floating buttons are absolutely positioned, so they must clear the system navigation bar
  // themselves (3-button navigation takes ~150 px on many phones; SafeAreaView padding does not
  // move absolute children).
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { projects: projectsModule } = useAppModules();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('TODOS');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [infoProject, setInfoProject] = useState<Project | null>(null);
  const [rawImportOpen, setRawImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const openInfo = useCallback((project: Project) => {
    setInfoProject(project);
  }, []);

  // RF-070: lets the user actually set the deadline/priority the pending-projects reminder
  // reads — previously only seed data had these fields.
  const updateReminder = useCallback(
    async (patch: { dueDate?: Date | null; priority?: ProjectPriority | null }) => {
      if (!infoProject) return;
      const updated = await projectsModule.updateProject.execute(infoProject.id, patch);
      setInfoProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    },
    [infoProject]
  );

  const confirmDelete = useCallback(
    (project: Project) => {
      Alert.alert(
        t('Apagar projeto'),
        t('Apagar "{name}"? Esta ação não pode ser desfeita.', { name: project.name }),
        [
          { text: t('Cancelar'), style: 'cancel' },
          {
            text: t('Apagar'),
            style: 'destructive',
            onPress: async () => {
              try {
                await projectsModule.deleteProject.execute(project.id);
                setProjects((prev) => prev.filter((p) => p.id !== project.id));
                setInfoProject(null);
              } catch (error) {
                errorLogger.log(error, 'ProjectsScreen.deleteProject');
                Alert.alert(t('Não foi possível apagar'), t('Tente novamente.'));
              }
            },
          },
        ]
      );
    },
    [projectsModule, t]
  );

  const loadProjects = useCallback(async () => {
    const mod = projectsModule;
    mediaRepair ??= mod
      .repairCacheMedia()
      .catch((error: unknown) => errorLogger.log(error, 'ProjectsScreen.persistMedia'));
    await mediaRepair;
    const all = await mod.listProjects.execute({ status: 'active' });
    // Most recently modified first.
    all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    setProjects(all);
    setLoading(false);
  }, []);

  // Reload every time the screen regains focus, e.g. coming back from an editor.
  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  // RF-028/US-11: a real device gallery import — creates a project from the file the user
  // actually picked, not a bundled demo asset.
  const importFromGallery = useCallback(async () => {
    setImporting(true);
    try {
      const picked = await pickFromGallery();
      if (!picked) return; // user cancelled

      const mod = projectsModule;
      const name = picked.fileName?.replace(/\.[^./]+$/, '') || 'Importado da galeria';
      const project = await mod.createProject.execute(
        name,
        picked.type === 'video' ? 'video' : 'photo'
      );
      await mod.addMediaAsset.execute(
        project.id,
        createMediaAsset(
          `asset_${Date.now()}`,
          picked.type,
          picked.uri,
          picked.uri,
          createMediaMetadata(picked.mimeType, {
            width: picked.width || undefined,
            height: picked.height || undefined,
            durationMs:
              picked.type === 'video'
                ? picked.durationMs || (await probeVideoDurationMs(picked.uri))
                : undefined,
            fileSizeBytes: picked.fileSizeBytes ?? undefined,
          })
        )
      );

      await loadProjects();
      navigation.navigate(picked.type === 'video' ? 'VideoEditor' : 'PhotoEditor', {
        projectId: project.id,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'PERMISSION_DENIED') {
        Alert.alert(
          'Permissão necessária',
          'Autorize o acesso à galeria nas configurações do dispositivo para importar arquivos.'
        );
      } else {
        errorLogger.log(error, 'ProjectsScreen.importFromGallery');
        Alert.alert('Não foi possível importar', 'Tente novamente.');
      }
    } finally {
      setImporting(false);
    }
  }, [navigation, loadProjects]);

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (activeTab === 'FOTOS') return p.type === 'photo';
        if (activeTab === 'VÍDEOS') return p.type === 'video';
        if (activeTab === 'RASCUNHOS') return isDraft(p);
        return true;
      }),
    [projects, activeTab]
  );

  const pendingProjects = useMemo(
    () =>
      projects.filter((p) => p.dueDate).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime()),
    [projects]
  );
  const nearest = pendingProjects[0];

  const multiSelectRef = useRef(multiSelect);
  multiSelectRef.current = multiSelect;

  const exitMultiSelect = () => {
    setMultiSelect(false);
    setSelected([]);
  };

  const onPressProject = useCallback(
    (project: Project) => {
      if (multiSelectRef.current) {
        setSelected((prev) =>
          prev.includes(project.id) ? prev.filter((x) => x !== project.id) : [...prev, project.id]
        );
      } else {
        navigation.navigate(project.type === 'video' ? 'VideoEditor' : 'PhotoEditor', {
          projectId: project.id,
        });
      }
    },
    [navigation]
  );

  const onLongPressProject = useCallback((project: Project) => {
    if (!multiSelectRef.current) {
      setMultiSelect(true);
      setSelected([project.id]);
    }
  }, []); // stable callback for memoized ProjectCard

  const renderProject = useCallback(
    ({ item }: { item: Project }) => (
      <ProjectCard
        project={item}
        isSelected={selected.includes(item.id)}
        multiSelect={multiSelect}
        onPressProject={onPressProject}
        onLongPressProject={onLongPressProject}
        onInfo={openInfo}
      />
    ),
    [selected, multiSelect, onPressProject, onLongPressProject, openInfo]
  );

  return (
    <SafeAreaView style={styles.container}>
      {multiSelect ? (
        <View style={styles.contextBar}>
          <Pressable onPress={exitMultiSelect} hitSlop={8}>
            <Icon name="x" size={22} />
          </Pressable>
          <Text style={styles.contextTitle}>{t('{n} selecionados', { n: selected.length })}</Text>
          {/* TODO: implement share / upload actions for the selection. */}
          <Icon name="share" size={20} />
          <Icon name="upload" size={20} />
        </View>
      ) : (
        <View style={styles.topBar}>
          <Pressable onPress={() => setDrawerOpen(true)} hitSlop={8}>
            <Icon name="menu" size={22} />
          </Pressable>
          <Text style={styles.topBarTitle}>{t('Projetos')}</Text>
          {/* TODO: real search + sort. */}
          <Icon name="search" size={20} />
          <View style={{ width: 8 }} />
          <Icon name="sort" size={20} />
        </View>
      )}

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {t(tab)}
            </Text>
            <View style={[styles.tabUnderline, activeTab === tab && styles.tabUnderlineActive]} />
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        extraData={selected}
        keyExtractor={(p) => p.id}
        renderItem={renderProject}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={{ paddingBottom: 24 }}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await loadProjects();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.acento}
          />
        }
        ListHeaderComponent={
          <>
            {nearest && <ReminderBanner pendingProjects={pendingProjects} nearest={nearest} />}

            {!loading && filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {t('Nenhum projeto nesta categoria ainda.')}
                </Text>
              </View>
            )}
          </>
        }
      />

      {!multiSelect && (
        <>
          <Pressable
            style={[styles.fab, styles.fabGallery, { bottom: 156 + insets.bottom }]}
            onPress={importFromGallery}
            disabled={importing}
          >
            <Icon name="image" size={20} color={colors.branco} />
          </Pressable>
          <Pressable
            style={[styles.fab, styles.fabRaw, { bottom: 88 + insets.bottom }]}
            onPress={() => setRawImportOpen(true)}
          >
            <Icon name="upload" size={20} color={colors.branco} />
          </Pressable>
          <Pressable
            style={[styles.fab, { bottom: 20 + insets.bottom }]}
            onPress={() => navigation.navigate('Camera')}
          >
            <Icon name="camera" size={24} color={colors.branco} />
          </Pressable>
        </>
      )}

      {rawImportOpen && (
        <RawImportSheet
          onClose={() => setRawImportOpen(false)}
          onConfirm={(result) => {
            setRawImportOpen(false);
            navigation.navigate('RawConverter', result);
          }}
        />
      )}

      {infoProject && (
        <ProjectInfoSheet
          // Fresh tab/date state for each project, as when the sheet used to reset on open.
          key={infoProject.id}
          project={infoProject}
          onClose={() => setInfoProject(null)}
          onUpdateReminder={updateReminder}
          onConfirmDelete={confirmDelete}
        />
      )}

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigation={navigation}
        current="Projects"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topBar: {
    height: 56,
    backgroundColor: colors.barra,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    elevation: 4,
  },
  topBarTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '500',
    color: colors.texto,
  },
  contextBar: {
    height: 56,
    backgroundColor: colors.barra,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  contextTitle: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.barra,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.texto2,
    paddingBottom: 8,
  },
  tabLabelActive: {
    color: colors.acento,
  },
  tabUnderline: {
    height: 2,
    width: '100%',
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: {
    backgroundColor: colors.acento,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: fontSize.sm,
    color: colors.texto2,
    textAlign: 'center',
  },
  gridRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabRaw: {
    bottom: 88,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  fabGallery: {
    bottom: 156,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
  },
});
