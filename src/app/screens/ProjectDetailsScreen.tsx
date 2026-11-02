import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { useI18n } from '@core/i18n';
import { LocalHistoryRepository, type Operation } from '@core/history';
import { errorLogger } from '@core/reliability';
import type { Project, ProjectPriority } from '@modules/projects';
import { useAppModules } from '../hooks';
import {
  codecLabel,
  dateFormatter,
  formatBitRate,
  formatDateInput,
  formatFileSize,
  formatTypeLabel,
  primaryAsset,
  priorityLabel,
} from './projects/projectFormat';
import { ProjectThumb } from './projects/ProjectThumb';
import { cancelProjectReminders, scheduleProjectReminders } from './projects/projectReminders';
import { shareProject } from './projects/shareProject';
import { probeCodecs } from '../../../modules/pixelmorph-video-export/src';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetails'>;

const PRIORITY_OPTIONS: readonly ProjectPriority[] = ['low', 'medium', 'high'];

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

function parseDateInput(text: string): Date | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** What a tap on a project opens: see and change its properties before entering the editor. */
export default function ProjectDetailsScreen({ navigation, route }: Props) {
  const { projectId } = route.params;
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { projects: projectsModule } = useAppModules();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [historyLog, setHistoryLog] = useState<readonly Operation[]>([]);
  const [codecs, setCodecs] = useState<string | null>(null);

  // On focus: coming back from the editor, the project and its history have changed.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      projectsModule.getProject
        .execute(projectId)
        .then((found) => {
          if (cancelled || !found) return;
          setProject(found);
          setName(found.name);
          setDueDateInput(formatDateInput(found.dueDate));
        })
        .catch((error) => errorLogger.log(error, 'ProjectDetails.load'));
      // RF-037 "histórico de edições": the real undo/redo log built for US-03.
      new LocalHistoryRepository()
        .load(projectId)
        .then((snapshot) => {
          if (!cancelled) setHistoryLog(snapshot?.past ?? []);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [projectId, projectsModule])
  );

  const asset = project ? primaryAsset(project) : undefined;
  const mediaUri = asset?.workingUri || asset?.originalUri;
  const isVideo = project?.type === 'video';

  // RF-037: a video's real codecs, read from the file (the stored MIME only says "video/mp4").
  useEffect(() => {
    if (!isVideo || !mediaUri) return undefined;
    let cancelled = false;
    probeCodecs(mediaUri)
      .then((mimes) => !cancelled && mimes.length > 0 && setCodecs(codecLabel(mimes)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isVideo, mediaUri]);

  if (!project) return <SafeAreaView style={styles.container} />;

  const update = async (patch: {
    name?: string;
    dueDate?: Date | null;
    priority?: ProjectPriority | null;
  }) => {
    try {
      const updated = await projectsModule.updateProject.execute(project.id, patch);
      scheduleProjectReminders(updated).catch(() => undefined);
      setProject(updated);
    } catch (error) {
      errorLogger.log(error, 'ProjectDetails.update');
      Alert.alert(t('Não foi possível salvar'), t('Tente novamente.'));
    }
  };

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) setName(project.name);
    else if (trimmed !== project.name) void update({ name: trimmed });
  };

  const openEditor = () =>
    navigation.navigate(isVideo ? 'VideoEditor' : 'PhotoEditor', { projectId: project.id });

  const confirmDelete = () =>
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
              cancelProjectReminders(project.id).catch(() => undefined);
              navigation.goBack();
            } catch (error) {
              errorLogger.log(error, 'ProjectDetails.delete');
              Alert.alert(t('Não foi possível apagar'), t('Tente novamente.'));
            }
          },
        },
      ]
    );

  const rows: [string, string][] = [
    [t('Tipo'), formatTypeLabel(project)],
    [
      t('Dimensões'),
      asset?.metadata.width && asset.metadata.height
        ? `${asset.metadata.width} × ${asset.metadata.height}`
        : '—',
    ],
    [t('Tamanho'), formatFileSize(asset?.metadata.fileSizeBytes)],
    [t('Codificação'), codecs ?? asset?.metadata.mimeType ?? '—'],
    ...(isVideo ? ([[t('Taxa de bits'), formatBitRate(asset)]] as [string, string][]) : []),
    [t('Modificado em'), dateFormatter.format(project.updatedAt)],
    [t('Criado em'), dateFormatter.format(project.createdAt)],
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel={t('Voltar')}>
          <Icon name="chevronLeft" size={26} />
        </Pressable>
        <View style={styles.topBarSpacer} />
        <Pressable
          onPress={() => shareProject(project)}
          hitSlop={8}
          accessibilityLabel={t('Compartilhar')}
        >
          <Icon name="share" size={22} />
        </Pressable>
        <Pressable onPress={confirmDelete} hitSlop={8} accessibilityLabel={t('Apagar projeto')}>
          <Icon name="trash" size={22} color={colors.perigo} />
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.preview}>
          <ProjectThumb project={project} style={styles.previewImage} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('Nome')}</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            returnKeyType="done"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('Lembrete')}</Text>
          <View style={styles.chips}>
            {PRIORITY_OPTIONS.map((p) => {
              const active = project.priority === p;
              return (
                <Pressable
                  key={p}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => void update({ priority: active ? null : p })}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(priorityLabel[p])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.dueRow}>
            <TextInput
              style={styles.dueInput}
              value={dueDateInput}
              onChangeText={setDueDateInput}
              placeholder={t('DD/MM/AAAA')}
              placeholderTextColor={colors.texto2}
              keyboardType="number-pad"
            />
            <Pressable
              style={styles.dueButton}
              onPress={() => {
                const parsed = parseDateInput(dueDateInput);
                if (!parsed) {
                  Alert.alert(t('Data inválida'), t('Use o formato DD/MM/AAAA.'));
                  return;
                }
                void update({ dueDate: parsed });
              }}
            >
              <Text style={styles.dueButtonText}>{t('Salvar prazo')}</Text>
            </Pressable>
            {project.dueDate && (
              <Pressable
                style={styles.dueButton}
                onPress={() => {
                  setDueDateInput('');
                  void update({ dueDate: null });
                }}
              >
                <Text style={styles.dueButtonText}>{t('Remover')}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('Propriedades')}</Text>
          {rows.map(([key, value]) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowKey}>{key}</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('Histórico')}</Text>
          {historyLog.length > 0 ? (
            [...historyLog].reverse().map((op) => (
              <View key={op.id} style={styles.row}>
                <Text style={styles.historyTime}>
                  {timeFormatter.format(new Date(op.timestamp))}
                </Text>
                <Text style={styles.historyAction}>{describeOperation(op)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>
              {t('Nenhuma edição registrada ainda para este projeto.')}
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable style={styles.openButton} onPress={openEditor}>
          <Text style={styles.openButtonText}>{t('Abrir no editor')}</Text>
        </Pressable>
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 12,
  },
  topBarSpacer: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  preview: {
    height: 280,
    backgroundColor: colors.faixa,
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  label: {
    marginBottom: 6,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  nameInput: {
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.barra,
    fontSize: fontSize.lg,
    fontWeight: '500',
    color: colors.texto,
  },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '700',
    color: colors.texto,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.barra,
  },
  chipActive: {
    backgroundColor: colors.texto,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.texto2,
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: colors.canvas,
  },
  dueRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dueInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.barra,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  dueButton: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.painel,
  },
  dueButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.texto,
  },
  row: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.barra,
  },
  rowKey: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  historyTime: {
    width: 44,
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  historyAction: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  empty: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    backgroundColor: colors.canvas,
  },
  openButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.texto,
  },
  openButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.canvas,
  },
});
