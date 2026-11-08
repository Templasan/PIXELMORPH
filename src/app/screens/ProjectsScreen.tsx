import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cancelProjectReminders } from './projects/projectReminders';
import {
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { retryFailedCardThumbs } from './projects/cardThumb';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon } from '@core/ui';
import { MainBar } from '../navigation/MainBar';
import { colors, fontSize } from '@core/theme';
import { useI18n } from '@core/i18n';
import type { Project } from '@modules/projects';
import { useAppModules } from '../hooks';
import { errorLogger } from '@core/reliability';
import {
  ProjectGroupRow,
  ProjectHero,
  PROJECT_ROW_HEIGHT,
  ProjectRow,
  ProjectTile,
  type ProjectLayout,
} from './projects/ProjectCard';
import { groupLabel, groupProjects } from './projects/projectGroups';
import { PROJECT_SORT_ORDER, queryProjects, type ProjectSort } from './projects/projectListQuery';
import { shareProject } from './projects/shareProject';

type Props = NativeStackScreenProps<RootStackParamList, 'Projects'>;

const TABS = ['TODOS', 'FOTOS', 'VÍDEOS', 'RASCUNHOS'] as const;
type Tab = (typeof TABS)[number];
/** The tab keys are uppercase; the chips read better in sentence case, in any language. */
const sentenceCase = (text: string) => text.charAt(0) + text.slice(1).toLowerCase();

/** Pictures an open group shows at first; "Ver mais" adds a page. Keeps a big month light. */
const GROUP_PAGE = 12;
const WEEK_KEY = 'week';
/** Two rows, so the months stay in sight below the current week. */
const WEEK_PAGE = 6;

const SORT_LABELS: Record<ProjectSort, string> = {
  recent: 'Mais recentes',
  name: 'Nome (A–Z)',
  oldest: 'Mais antigos',
};

/** True when a project has never produced a final export — used for the RASCUNHOS tab. */
function isDraft(project: Project): boolean {
  return !project.thumbnailUri;
}

// Once per app session: copy media older projects still reference in the cache to permanent
// storage (see repairCacheMedia).
let mediaRepair: Promise<unknown> | null = null;

export default function ProjectsScreen({ navigation }: Props) {
  const { t, language } = useI18n();
  const { projects: projectsModule } = useAppModules();
  const [activeTab, setActiveTab] = useState<Tab>('TODOS');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ProjectSort>('recent');
  const [layout, setLayout] = useState<ProjectLayout>('grid');
  const [expanded, setExpanded] = useState<string[]>([WEEK_KEY]);
  const [groupLimits, setGroupLimits] = useState<Record<string, number>>({});

  // Deletes one at a time and keeps going, so one failure does not leave the rest selected.
  const confirmDeleteSelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      Alert.alert(
        t(ids.length === 1 ? 'Apagar projeto' : 'Apagar projetos'),
        ids.length === 1
          ? t('Apagar 1 projeto? Esta ação não pode ser desfeita.')
          : t('Apagar {n} projetos? Esta ação não pode ser desfeita.', { n: ids.length }),
        [
          { text: t('Cancelar'), style: 'cancel' },
          {
            text: t('Apagar'),
            style: 'destructive',
            onPress: async () => {
              const deleted: string[] = [];
              for (const id of ids) {
                try {
                  await projectsModule.deleteProject.execute(id);
                  cancelProjectReminders(id).catch(() => undefined);
                  deleted.push(id);
                } catch (error) {
                  errorLogger.log(error, 'ProjectsScreen.deleteSelected');
                }
              }
              setProjects((prev) => prev.filter((p) => !deleted.includes(p.id)));
              setSelected((prev) => prev.filter((id) => !deleted.includes(id)));
              if (deleted.length < ids.length) {
                Alert.alert(t('Não foi possível apagar'), t('Tente novamente.'));
              } else {
                setMultiSelect(false);
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
    try {
      setProjects(await mod.listProjects.execute({ status: 'active' }));
    } catch (error) {
      // Unreadable project list: show what we have instead of loading forever.
      errorLogger.log(error, 'ProjectsScreen.loadProjects');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload every time the screen regains focus, e.g. coming back from an editor.
  useFocusEffect(
    useCallback(() => {
      loadProjects();
      retryFailedCardThumbs();
    }, [loadProjects])
  );

  const filtered = useMemo(
    () =>
      queryProjects(
        projects.filter((p) => {
          if (activeTab === 'FOTOS') return p.type === 'photo';
          if (activeTab === 'VÍDEOS') return p.type === 'video';
          if (activeTab === 'RASCUNHOS') return isDraft(p);
          return true;
        }),
        query,
        sort
      ),
    [projects, activeTab, query, sort]
  );

  const chooseSort = () => {
    Alert.alert(t('Ordenar por'), undefined, [
      ...PROJECT_SORT_ORDER.map((option) => ({
        text: `${option === sort ? '✓ ' : ''}${t(SORT_LABELS[option])}`,
        onPress: () => setSort(option),
      })),
      { text: t('Cancelar'), style: 'cancel' as const },
    ]);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const pendingProjects = useMemo(
    () =>
      projects.filter((p) => p.dueDate).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime()),
    [projects]
  );
  const nearest = pendingProjects[0];

  const grouped = useMemo(() => groupProjects(filtered, new Date()), [filtered]);

  // The albums only make sense for the default browsing; a search or another order is one grid.
  const showAlbums = layout === 'grid' && !searchOpen && !query.trim() && sort === 'recent';
  // Always the project edited last: the filter chips sit below it and do not touch it.
  const hero = showAlbums ? queryProjects(projects, '', 'recent')[0] : undefined;
  const weekProjects = grouped.week.filter((p) => p !== hero);
  const groupSections = [
    ...(weekProjects.length > 0
      ? [{ key: WEEK_KEY, label: t('Esta semana'), projects: weekProjects }]
      : []),
    ...grouped.groups.map((g) => ({ ...g, label: groupLabel(g, language) })),
  ];
  const flatProjects = filtered;

  useEffect(() => {
    if (!multiSelect) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setMultiSelect(false);
      setSelected([]);
      return true;
    });
    return () => subscription.remove();
  }, [multiSelect]);

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
        navigation.navigate('ProjectDetails', { projectId: project.id });
      }
    },
    [navigation]
  );

  const openEditor = useCallback(
    (project: Project) =>
      navigation.navigate(project.type === 'video' ? 'VideoEditor' : 'PhotoEditor', {
        projectId: project.id,
      }),
    [navigation]
  );

  const pressGroup = (group: { key: string; projects: Project[] }) => {
    if (!multiSelect) {
      setExpanded((prev) =>
        prev.includes(group.key) ? prev.filter((k) => k !== group.key) : [...prev, group.key]
      );
      return;
    }
    const ids = group.projects.map((p) => p.id);
    const allSelectedHere = ids.every((id) => selected.includes(id));
    setSelected((prev) =>
      allSelectedHere ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    );
  };

  const longPressGroup = (group: { projects: Project[] }) => {
    if (multiSelect) return;
    setMultiSelect(true);
    setSelected(group.projects.map((p) => p.id));
  };

  // Everything the current filter holds, opened or not.
  const selectableIds = flatProjects.map((p) => p.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));
  const toggleSelectAll = () => setSelected(allSelected ? [] : selectableIds);

  const onLongPressProject = useCallback((project: Project) => {
    if (!multiSelectRef.current) {
      setMultiSelect(true);
      setSelected([project.id]);
    }
  }, []); // stable callback for memoized ProjectCard

  const itemProps = { multiSelect, onPressProject, onLongPressProject };
  const renderTile = useCallback(
    ({ item }: { item: Project }) => (
      <View style={styles.tileCell}>
        <ProjectTile
          project={item}
          isSelected={selected.includes(item.id)}
          multiSelect={multiSelect}
          onPressProject={onPressProject}
          onLongPressProject={onLongPressProject}
        />
      </View>
    ),
    [selected, multiSelect, onPressProject, onLongPressProject]
  );
  const renderRow = useCallback(
    ({ item }: { item: Project }) => (
      <ProjectRow
        project={item}
        isSelected={selected.includes(item.id)}
        multiSelect={multiSelect}
        onPressProject={onPressProject}
        onLongPressProject={onLongPressProject}
      />
    ),
    [selected, multiSelect, onPressProject, onLongPressProject]
  );

  const refreshControl = (
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
  );

  const listTools = (
    <View style={styles.tools}>
      {searchOpen ? (
        <>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Buscar projetos')}
            placeholderTextColor={colors.texto2}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          <Pressable onPress={closeSearch} hitSlop={8} accessibilityLabel={t('Fechar')}>
            <Icon name="x" size={22} />
          </Pressable>
        </>
      ) : (
        <>
          <Pressable style={styles.sortButton} onPress={chooseSort} hitSlop={8}>
            <Text style={styles.sortLabel}>{t(SORT_LABELS[sort])}</Text>
            <Icon name="chevronDown" size={18} color={colors.texto2} />
          </Pressable>
          <Pressable
            onPress={() => setSearchOpen(true)}
            hitSlop={8}
            accessibilityLabel={t('Buscar projetos')}
          >
            <Icon name="search" size={22} />
          </Pressable>
          <Pressable
            onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
            hitSlop={8}
            accessibilityLabel={layout === 'grid' ? t('Ver em lista') : t('Ver em grade')}
          >
            <Icon name={layout === 'grid' ? 'list' : 'grid'} size={22} />
          </Pressable>
        </>
      )}
    </View>
  );

  const filterChips = (
    <View style={styles.tabs}>
      {TABS.map((tab) => {
        const active = activeTab === tab;
        return (
          <Pressable
            key={tab}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
              {sentenceCase(t(tab))}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // Search results are found by name, so they always show it, whatever the view.
  const showRows = layout === 'list' || searchOpen;
  // A single project is the hero card above the grid, so it counts as something to show.
  const heroShown = !!hero && filtered.includes(hero);
  const nothingToShow = showAlbums ? groupSections.length === 0 && !heroShown : filtered.length === 0;
  const emptyState = !loading && nothingToShow && (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>
        {query.trim()
          ? t('Nenhum projeto encontrado.')
          : t('Nenhum projeto nesta categoria ainda.')}
      </Text>
    </View>
  );

  // Sharing takes one file, so the icon is live only when exactly one project is selected.
  const selectedProject =
    selected.length === 1 ? projects.find((p) => p.id === selected[0]) : undefined;

  return (
    // The bottom edge is MainBar's: it pads itself above the system navigation.
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {multiSelect ? (
        <View style={styles.contextBar}>
          <Pressable onPress={exitMultiSelect} hitSlop={8}>
            <Icon name="x" size={22} />
          </Pressable>
          <Text style={styles.contextTitle}>
            {selected.length === 1
              ? t('{n} selecionado', { n: 1 })
              : t('{n} selecionados', { n: selected.length })}
          </Text>
          <Pressable
            onPress={toggleSelectAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: allSelected }}
          >
            <Text style={styles.selectAll}>{allSelected ? t('Limpar') : t('Selecionar tudo')}</Text>
          </Pressable>
          <Pressable
            onPress={() => selectedProject && shareProject(selectedProject)}
            disabled={!selectedProject}
            hitSlop={8}
            accessibilityLabel={t('Compartilhar')}
          >
            <Icon name="share" size={20} color={selectedProject ? colors.texto : colors.linha} />
          </Pressable>
          <Pressable
            onPress={() => confirmDeleteSelected(selected)}
            disabled={selected.length === 0}
            hitSlop={8}
            accessibilityLabel={t('Apagar projetos')}
          >
            <Icon name="trash" size={20} color={selected.length ? colors.perigo : colors.linha} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>{t('Projetos')}</Text>
        </View>
      )}

      {showAlbums ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.pageEnd}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          refreshControl={refreshControl}
        >
          {hero && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{t('Continuar editando')}</Text>
                {nearest && (
                  <Pressable onPress={() => onPressProject(nearest)} hitSlop={8}>
                    <Text style={styles.pendingLink}>
                      {pendingProjects.length === 1
                        ? t('{n} pendente', { n: 1 })
                        : t('{n} pendentes', { n: pendingProjects.length })}{' '}
                      ›
                    </Text>
                  </Pressable>
                )}
              </View>
              <ProjectHero
                project={hero}
                onPress={onPressProject}
                onLongPress={onLongPressProject}
                onOpen={openEditor}
                multiSelect={multiSelect}
                isSelected={selected.includes(hero.id)}
              />
            </View>
          )}
          {filterChips}
          {listTools}
          {emptyState}
          {groupSections.map((group) => {
            const isOpen = expanded.includes(group.key);
            const page =
              groupLimits[group.key] ?? (group.key === WEEK_KEY ? WEEK_PAGE : GROUP_PAGE);
            // A button that would reveal a single picture costs more room than the picture.
            const limit = group.projects.length - page === 1 ? group.projects.length : page;
            const hidden = group.projects.length - limit;
            return (
              <View key={group.key}>
                <ProjectGroupRow
                  label={group.label}
                  count={group.projects.length}
                  projects={group.projects}
                  expanded={isOpen}
                  multiSelect={multiSelect}
                  isSelected={multiSelect && group.projects.every((p) => selected.includes(p.id))}
                  onPress={() => pressGroup(group)}
                  onLongPress={() => longPressGroup(group)}
                />
                {isOpen && (
                  <View style={styles.groupGrid}>
                    {group.projects.slice(0, limit).map((item) => (
                      <View key={item.id} style={styles.tileCell}>
                        <ProjectTile
                          project={item}
                          isSelected={selected.includes(item.id)}
                          {...itemProps}
                        />
                      </View>
                    ))}
                    {hidden > 0 && (
                      <Pressable
                        style={styles.moreButton}
                        onPress={() =>
                          setGroupLimits((prev) => ({ ...prev, [group.key]: limit + GROUP_PAGE }))
                        }
                      >
                        <Text style={styles.moreLabel}>{t('Ver mais {n}', { n: hidden })}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.body}>
          {filterChips}
          {listTools}
          {showRows ? (
            <FlatList
              key="list"
              style={styles.body}
              data={flatProjects}
              extraData={selected}
              keyExtractor={(p) => p.id}
              renderItem={renderRow}
              // Fixed heights: measuring rows while flinging made the list jump.
              getItemLayout={(_, index) => ({
                length: PROJECT_ROW_HEIGHT,
                offset: PROJECT_ROW_HEIGHT * index,
                index,
              })}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={7}
              refreshControl={refreshControl}
              ListHeaderComponent={<>{emptyState}</>}
            />
          ) : (
            <FlatList
              key="grid"
              style={styles.body}
              data={flatProjects}
              extraData={selected}
              keyExtractor={(p) => p.id}
              renderItem={renderTile}
              // A FlatList cannot change its columns in place, hence the keys.
              numColumns={3}
              contentContainerStyle={styles.tileGrid}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              initialNumToRender={18}
              maxToRenderPerBatch={12}
              windowSize={7}
              refreshControl={refreshControl}
              ListHeaderComponent={<>{emptyState}</>}
            />
          )}
        </View>
      )}

      {/* Hidden, not removed, while selecting: its height keeps the page from jumping. */}
      <View style={multiSelect && styles.barHidden} pointerEvents={multiSelect ? 'none' : 'auto'}>
        <MainBar active="Projects" />
      </View>
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
    backgroundColor: colors.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 18,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    color: colors.texto,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.texto,
    paddingVertical: 0,
  },
  contextBar: {
    height: 60,
    backgroundColor: colors.barra,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  selectAll: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.texto,
  },
  contextTitle: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  tools: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sortButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
    backgroundColor: colors.canvas,
  },
  tab: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.barra,
  },
  tabActive: {
    backgroundColor: colors.texto,
  },
  tabLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.texto2,
  },
  tabLabelActive: {
    color: colors.canvas,
  },
  // The camera button rises over the end of the page.
  pageEnd: {
    paddingBottom: 32,
  },
  barHidden: {
    opacity: 0,
  },
  body: {
    flex: 1,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.texto2,
  },
  pendingLink: {
    fontSize: fontSize.sm,
    color: colors.alerta,
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  moreButton: {
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.texto,
  },
  tileGrid: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 12,
  },
  tileCell: {
    width: '33.333%',
    padding: 2,
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
});
