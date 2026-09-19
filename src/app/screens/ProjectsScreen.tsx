import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, SideDrawer } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import {
  createProjectsModule,
  createMediaAsset,
  createMediaMetadata,
  type Project,
  type MediaAsset,
  type ProjectPriority,
} from '@modules/projects';
import { LocalHistoryRepository, type Operation } from '@core/history';
import { rawFormatLabel } from '@modules/photo-editor/raw';
import { pickFromGallery } from '@modules/device-media';
import { errorLogger } from '@core/reliability';
import { seedDemoProjectsIfEmpty } from '../bootstrap/seedDemoProjects';
import { RawImportSheet } from './projects/RawImportSheet';

const FIELD_LABELS: Record<string, string> = {
  temperatura: 'Temperatura',
  matiz: 'Matiz',
  saturacao: 'Saturação',
  luminosidade: 'Luminosidade',
  vibracao: 'Vibração',
  exposicao: 'Exposição',
};

const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function describeOperation(op: Operation): string {
  const label = FIELD_LABELS[op.type] ?? op.type;
  const to = op.params.to as number;
  const sign = typeof to === 'number' && to > 0 ? '+' : '';
  return `${label} ajustada para ${sign}${to}`;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Projects'>;

const TABS = ['TODOS', 'FOTOS', 'VÍDEOS', 'RASCUNHOS'] as const;
type Tab = (typeof TABS)[number];

const INFO_TABS = ['PROPRIEDADES', 'HISTÓRICO'] as const;
type InfoTab = (typeof INFO_TABS)[number];

const BATCH_PRESETS = ['P&B', 'Vívido', 'Sépia', 'Frio', 'Cine'];

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function primaryAsset(project: Project): MediaAsset | undefined {
  return project.assets[0];
}

/** True when a project has never produced a final export — used for the RASCUNHOS tab. */
function isDraft(project: Project): boolean {
  return !project.thumbnailUri;
}

function formatTypeLabel(project: Project): string {
  const asset = primaryAsset(project);
  if (!asset) return project.type.toUpperCase();

  const raw = rawFormatLabel(asset.metadata.mimeType);
  if (raw) return raw;

  const subtype = asset.metadata.mimeType.split('/')[1]?.toUpperCase() ?? project.type;
  if (project.type === 'video') {
    const is4k = (asset.metadata.width ?? 0) >= 3840;
    return `${subtype === 'QUICKTIME' ? 'MOV' : subtype} ${is4k ? '· 4K' : ''}`.trim();
  }
  if (subtype === 'VND.ADOBE.PHOTOSHOP') return 'PSD';
  return subtype;
}

function formatDuration(durationMs: number | undefined): string | null {
  if (!durationMs) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

function formatBitRate(asset: MediaAsset | undefined): string {
  if (!asset?.metadata.durationMs || !asset.metadata.fileSizeBytes) return '—';
  const kbps = (asset.metadata.fileSizeBytes * 8) / asset.metadata.durationMs;
  return `${Math.round(kbps)} kbps`;
}

function daysUntil(date: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - startOfToday.getTime()) / msPerDay);
}

const priorityLabel: Record<string, string> = {
  low: 'baixa',
  medium: 'média',
  high: 'alta',
};

const PRIORITY_OPTIONS: readonly ProjectPriority[] = ['low', 'medium', 'high'];

// RF-070: a plain DD/MM/AAAA text field is enough to set a reminder deadline — no calendar
// picker dependency needed for that.
function parseDateInput(text: string): Date | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateInput(date: Date | undefined): string {
  if (!date) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export default function ProjectsScreen({ navigation }: Props) {
  const moduleRef = useRef(createProjectsModule());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('TODOS');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [infoProject, setInfoProject] = useState<Project | null>(null);
  const [infoTab, setInfoTab] = useState<InfoTab>('PROPRIEDADES');
  const [historyLog, setHistoryLog] = useState<readonly Operation[]>([]);
  const [batchProgress, setBatchProgress] = useState<number | null>(null);
  const batchTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rawImportOpen, setRawImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dueDateInput, setDueDateInput] = useState('');

  const openInfo = useCallback((project: Project) => {
    setInfoProject(project);
    setInfoTab('PROPRIEDADES');
    setDueDateInput(formatDateInput(project.dueDate));
    // RF-037 "histórico de edições": pulls the real undo/redo log built for US-03.
    new LocalHistoryRepository().load(project.id).then((snapshot) => {
      setHistoryLog(snapshot?.past ?? []);
    });
  }, []);

  // RF-070: lets the user actually set the deadline/priority the pending-projects reminder
  // reads — previously only seed data had these fields.
  const updateReminder = useCallback(
    async (patch: { dueDate?: Date | null; priority?: ProjectPriority | null }) => {
      if (!infoProject) return;
      const updated = await moduleRef.current.updateProject.execute(infoProject.id, patch);
      setInfoProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    },
    [infoProject]
  );

  const loadProjects = useCallback(async () => {
    const mod = moduleRef.current;
    await seedDemoProjectsIfEmpty(mod);
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

      const mod = moduleRef.current;
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
            durationMs: picked.durationMs ?? undefined,
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

  const filtered = projects.filter((p) => {
    if (activeTab === 'FOTOS') return p.type === 'photo';
    if (activeTab === 'VÍDEOS') return p.type === 'video';
    if (activeTab === 'RASCUNHOS') return isDraft(p);
    return true;
  });

  const pendingProjects = projects
    .filter((p) => p.dueDate)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const nearest = pendingProjects[0];

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const exitMultiSelect = () => {
    setMultiSelect(false);
    setSelected([]);
  };

  const openProject = (project: Project) => {
    navigation.navigate(project.type === 'video' ? 'VideoEditor' : 'PhotoEditor', {
      projectId: project.id,
    });
  };

  const applyBatch = () => {
    // TODO: wire to a real batch-preset use case (needs the non-destructive photo
    // pipeline from US-04/US-08); this only animates a progress bar for now.
    setBatchProgress(0);
    batchTimer.current = setInterval(() => {
      setBatchProgress((prev) => {
        if (prev === null || prev >= 100) {
          if (batchTimer.current) clearInterval(batchTimer.current);
          exitMultiSelect();
          return null;
        }
        return prev + 12;
      });
    }, 150);
  };

  return (
    <SafeAreaView style={styles.container}>
      {multiSelect ? (
        <View style={styles.contextBar}>
          <Pressable onPress={exitMultiSelect} hitSlop={8}>
            <Icon name="x" size={22} />
          </Pressable>
          <Text style={styles.contextTitle}>{selected.length} selecionados</Text>
          {/* TODO: implement share / upload actions for the selection. */}
          <Icon name="share" size={20} />
          <Icon name="upload" size={20} />
        </View>
      ) : (
        <View style={styles.topBar}>
          <Pressable onPress={() => setDrawerOpen(true)} hitSlop={8}>
            <Icon name="menu" size={22} />
          </Pressable>
          <Text style={styles.topBarTitle}>Projetos</Text>
          {/* TODO: real search + sort. */}
          <Icon name="search" size={20} />
          <View style={{ width: 8 }} />
          <Icon name="sort" size={20} />
        </View>
      )}

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} style={styles.tab} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabLabel, activeTab === t && styles.tabLabelActive]}>{t}</Text>
            <View style={[styles.tabUnderline, activeTab === t && styles.tabUnderlineActive]} />
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadProjects} tintColor={colors.acento} />
        }
      >
        {nearest && (
          <View style={styles.reminderCard}>
            <View style={styles.reminderStripe} />
            <View style={{ padding: 8, paddingHorizontal: 12 }}>
              <Text style={styles.reminderTitle}>
                {pendingProjects.length}{' '}
                {pendingProjects.length === 1 ? 'projeto pendente' : 'projetos pendentes'}
              </Text>
              <Text style={styles.reminderSubtitle}>
                {nearest.name}{' '}
                {(() => {
                  const days = daysUntil(nearest.dueDate!);
                  if (days < 0) return `atrasado há ${Math.abs(days)} dia(s)`;
                  if (days === 0) return 'vence hoje';
                  return `vence em ${days} dia(s)`;
                })()}
                {nearest.priority ? ` · Prioridade ${priorityLabel[nearest.priority]}` : ''}
              </Text>
            </View>
          </View>
        )}

        {!loading && filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Nenhum projeto nesta categoria ainda.</Text>
          </View>
        )}

        <View style={styles.grid}>
          {filtered.map((project) => {
            const isSelected = selected.includes(project.id);
            const asset = primaryAsset(project);
            const thumbUri = project.thumbnailUri ?? asset?.originalUri;
            const isVideo = project.type === 'video';
            const duration = formatDuration(asset?.metadata.durationMs);
            return (
              <Pressable
                key={project.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onLongPress={() => {
                  if (!multiSelect) {
                    setMultiSelect(true);
                    setSelected([project.id]);
                  }
                }}
                onPress={() => (multiSelect ? toggleSelect(project.id) : openProject(project))}
              >
                <View style={styles.thumbWrap}>
                  {thumbUri ? (
                    <Image source={{ uri: thumbUri }} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Icon name={isVideo ? 'film' : 'image'} size={28} color={colors.linha} />
                    </View>
                  )}
                  {isVideo && (
                    <>
                      <View style={styles.playOverlay}>
                        <View style={styles.playBadge}>
                          <Icon name="play" size={16} color={colors.texto} />
                        </View>
                      </View>
                      {duration && (
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>{duration}</Text>
                        </View>
                      )}
                    </>
                  )}
                  {multiSelect && (
                    <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                      {isSelected && <Icon name="check" size={12} color={colors.preto} />}
                    </View>
                  )}
                </View>
                <View style={styles.cardInfo}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {project.name}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {dateFormatter.format(project.updatedAt)} · {formatTypeLabel(project)}
                    </Text>
                  </View>
                  <Pressable hitSlop={8} onPress={() => openInfo(project)}>
                    <Icon name="info" size={14} color={colors.texto2} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {!multiSelect && (
        <>
          <Pressable
            style={[styles.fab, styles.fabGallery]}
            onPress={importFromGallery}
            disabled={importing}
          >
            <Icon name="image" size={20} color={colors.branco} />
          </Pressable>
          <Pressable style={[styles.fab, styles.fabRaw]} onPress={() => setRawImportOpen(true)}>
            <Icon name="upload" size={20} color={colors.branco} />
          </Pressable>
          <Pressable style={styles.fab} onPress={() => navigation.navigate('Camera')}>
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

      {multiSelect && selected.length > 0 && (
        <View style={styles.batchSheet}>
          <Text style={styles.batchLabel}>APLICAR EM LOTE</Text>
          <View style={styles.batchChips}>
            {BATCH_PRESETS.map((p) => (
              // TODO: apply the real preset to the selected projects.
              <Pressable key={p} style={styles.batchChip}>
                <Text style={styles.batchChipText}>{p}</Text>
              </Pressable>
            ))}
          </View>
          {batchProgress !== null ? (
            <View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${batchProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>{batchProgress}%</Text>
            </View>
          ) : (
            <Pressable style={styles.batchButton} onPress={applyBatch}>
              <Text style={styles.batchButtonText}>
                APLICAR EM {selected.length} {selected.length === 1 ? 'ITEM' : 'ITENS'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {infoProject && (
        <View style={styles.infoSheet}>
          <View style={styles.infoHeader}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {INFO_TABS.map((t) => (
                <Pressable key={t} onPress={() => setInfoTab(t)}>
                  <Text style={[styles.infoTabLabel, infoTab === t && styles.infoTabLabelActive]}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setInfoProject(null)} hitSlop={8}>
              <Icon name="x" size={18} />
            </Pressable>
          </View>
          <ScrollView>
            {infoTab === 'PROPRIEDADES' ? (
              (() => {
                const asset = primaryAsset(infoProject);
                const rows: [string, string][] = [
                  ['Nome', infoProject.name],
                  ['Tipo', formatTypeLabel(infoProject)],
                  [
                    'Dimensões',
                    asset?.metadata.width && asset.metadata.height
                      ? `${asset.metadata.width} × ${asset.metadata.height}`
                      : '—',
                  ],
                  ['Tamanho', formatFileSize(asset?.metadata.fileSizeBytes)],
                  ['Codificação', asset?.metadata.mimeType ?? '—'],
                  ['Taxa de bits', infoProject.type === 'video' ? formatBitRate(asset) : '—'],
                  ['Modificado em', dateFormatter.format(infoProject.updatedAt)],
                  ['Criado em', dateFormatter.format(infoProject.createdAt)],
                ];
                return (
                  <>
                    {rows.map(([k, v]) => (
                      <View key={k} style={styles.infoRow}>
                        <Text style={styles.infoKey}>{k}</Text>
                        <Text style={styles.infoValue}>{v}</Text>
                      </View>
                    ))}
                    <View style={styles.reminderEditor}>
                      <Text style={styles.sectionLabel}>LEMBRETE</Text>
                      <View style={styles.priorityChips}>
                        {PRIORITY_OPTIONS.map((p) => (
                          <Pressable
                            key={p}
                            style={[
                              styles.priorityChip,
                              infoProject.priority === p && styles.priorityChipActive,
                            ]}
                            onPress={() =>
                              updateReminder({
                                priority: infoProject.priority === p ? null : p,
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.priorityChipText,
                                infoProject.priority === p && styles.priorityChipTextActive,
                              ]}
                            >
                              {priorityLabel[p]}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <View style={styles.dueDateRow}>
                        <TextInput
                          style={styles.dueDateInput}
                          value={dueDateInput}
                          onChangeText={setDueDateInput}
                          placeholder="DD/MM/AAAA"
                          placeholderTextColor={colors.texto2}
                          keyboardType="number-pad"
                        />
                        <Pressable
                          style={styles.dueDateButton}
                          onPress={() => {
                            const parsed = parseDateInput(dueDateInput);
                            if (!parsed) {
                              Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.');
                              return;
                            }
                            updateReminder({ dueDate: parsed });
                          }}
                        >
                          <Text style={styles.dueDateButtonText}>Salvar prazo</Text>
                        </Pressable>
                        {infoProject.dueDate && (
                          <Pressable
                            style={styles.dueDateButton}
                            onPress={() => {
                              setDueDateInput('');
                              updateReminder({ dueDate: null });
                            }}
                          >
                            <Text style={styles.dueDateButtonText}>Remover</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </>
                );
              })()
            ) : historyLog.length > 0 ? (
              [...historyLog].reverse().map((op) => (
                <View key={op.id} style={styles.historyRow}>
                  <Text style={styles.historyTime}>
                    {timeFormatter.format(new Date(op.timestamp))}
                  </Text>
                  <Text style={styles.historyAction}>{describeOperation(op)}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Nenhuma edição registrada ainda para este projeto.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
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
  reminderCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: colors.painel,
    flexDirection: 'row',
  },
  reminderStripe: {
    width: 4,
    backgroundColor: colors.alerta,
  },
  reminderTitle: {
    fontSize: fontSize.xs,
    color: colors.texto,
    fontWeight: '500',
  },
  reminderSubtitle: {
    fontSize: 11,
    color: colors.texto2,
    marginTop: 2,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  card: {
    width: '48%',
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  cardSelected: {
    borderColor: colors.acento,
  },
  thumbWrap: {
    aspectRatio: 1,
    backgroundColor: colors.faixa,
    position: 'relative',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.texto,
  },
  checkCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.texto,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    borderColor: colors.acento,
    backgroundColor: colors.acento,
  },
  cardInfo: {
    padding: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  cardName: {
    fontSize: fontSize.xs,
    color: colors.texto,
    fontWeight: '500',
  },
  cardMeta: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.texto2,
    marginTop: 2,
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
  batchSheet: {
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    padding: 16,
  },
  batchLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.texto2,
    marginBottom: 8,
  },
  batchChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  batchChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  batchChipText: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  batchButton: {
    height: 36,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: '#0D2036',
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.linha,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.acento,
  },
  progressText: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  infoSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '40%',
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  infoHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  infoTabLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.texto2,
  },
  infoTabLabelActive: {
    color: colors.acento,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  infoKey: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  infoValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  reminderEditor: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.texto2,
    marginBottom: 8,
  },
  priorityChips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  priorityChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  priorityChipActive: {
    borderColor: colors.acento,
  },
  priorityChipText: {
    fontSize: fontSize.xs,
    color: colors.texto,
    textTransform: 'capitalize',
  },
  priorityChipTextActive: {
    color: colors.acento,
  },
  dueDateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dueDateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.linha,
    paddingHorizontal: 10,
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  dueDateButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: colors.acento,
  },
  dueDateButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: '#0D2036',
  },
  historyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  historyTime: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
    width: 40,
  },
  historyAction: {
    fontSize: fontSize.xs,
    color: colors.texto,
    flex: 1,
  },
});
