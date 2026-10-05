import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import type { Project, ProjectPriority } from '@modules/projects';
import { useI18n } from '@core/i18n';
import { LocalHistoryRepository, type Operation } from '@core/history';
import {
  dateFormatter,
  formatBitRate,
  formatDateInput,
  formatFileSize,
  formatTypeLabel,
  primaryAsset,
  priorityLabel,
} from './projectFormat';

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

type InfoTab = 'PROPRIEDADES' | 'HISTÓRICO';

interface ProjectInfoSheetProps {
  project: Project;
  onClose: () => void;
  onUpdateReminder: (patch: { dueDate?: Date | null; priority?: ProjectPriority | null }) => void;
  onConfirmDelete: (project: Project) => void;
}

export function ProjectInfoSheet({
  project,
  onClose,
  onUpdateReminder,
  onConfirmDelete,
}: ProjectInfoSheetProps) {
  const { t } = useI18n();
  const [infoTab, setInfoTab] = useState<InfoTab>('PROPRIEDADES');
  const [historyLog, setHistoryLog] = useState<readonly Operation[]>([]);
  const [dueDateInput, setDueDateInput] = useState(formatDateInput(project.dueDate));

  // RF-037 "histórico de edições": the real undo/redo log built for US-03, loaded once per project.
  useEffect(() => {
    let cancelled = false;
    new LocalHistoryRepository()
      .load(project.id)
      .then((snapshot) => {
        if (!cancelled) setHistoryLog(snapshot?.past ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const asset = primaryAsset(project);
  const rows: [string, string][] = [
    [t('Nome'), project.name],
    [t('Tipo'), formatTypeLabel(project)],
    [
      t('Dimensões'),
      asset?.metadata.width && asset.metadata.height
        ? `${asset.metadata.width} × ${asset.metadata.height}`
        : '—',
    ],
    [t('Tamanho'), formatFileSize(asset?.metadata.fileSizeBytes)],
    [t('Codificação'), asset?.metadata.mimeType ?? '—'],
    [t('Taxa de bits'), project.type === 'video' ? formatBitRate(asset) : '—'],
    [t('Modificado em'), dateFormatter.format(project.updatedAt)],
    [t('Criado em'), dateFormatter.format(project.createdAt)],
  ];

  return (
    <View style={styles.infoSheet}>
      <View style={styles.infoHeader}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {(['PROPRIEDADES', 'HISTÓRICO'] as const).map((tab) => (
            <Pressable key={tab} onPress={() => setInfoTab(tab)}>
              <Text style={[styles.infoTabLabel, infoTab === tab && styles.infoTabLabelActive]}>
                {t(tab)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="x" size={18} />
        </Pressable>
      </View>
      <ScrollView>
        {infoTab === 'PROPRIEDADES' ? (
          <>
            {rows.map(([k, v]) => (
              <View key={k} style={styles.infoRow}>
                <Text style={styles.infoKey}>{k}</Text>
                <Text style={styles.infoValue}>{v}</Text>
              </View>
            ))}
            <View style={styles.reminderEditor}>
              <Text style={styles.sectionLabel}>{t('LEMBRETE')}</Text>
              <View style={styles.priorityChips}>
                {PRIORITY_OPTIONS.map((p) => (
                  <Pressable
                    key={p}
                    style={[
                      styles.priorityChip,
                      project.priority === p && styles.priorityChipActive,
                    ]}
                    onPress={() =>
                      onUpdateReminder({
                        priority: project.priority === p ? null : p,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.priorityChipText,
                        project.priority === p && styles.priorityChipTextActive,
                      ]}
                    >
                      {t(priorityLabel[p])}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.dueDateRow}>
                <TextInput
                  style={styles.dueDateInput}
                  value={dueDateInput}
                  onChangeText={setDueDateInput}
                  placeholder={t('DD/MM/AAAA')}
                  placeholderTextColor={colors.texto2}
                  keyboardType="number-pad"
                />
                <Pressable
                  style={styles.dueDateButton}
                  onPress={() => {
                    const parsed = parseDateInput(dueDateInput);
                    if (!parsed) {
                      Alert.alert(t('Data inválida'), t('Use o formato DD/MM/AAAA.'));
                      return;
                    }
                    onUpdateReminder({ dueDate: parsed });
                  }}
                >
                  <Text style={styles.dueDateButtonText}>{t('Salvar prazo')}</Text>
                </Pressable>
                {project.dueDate && (
                  <Pressable
                    style={styles.dueDateButton}
                    onPress={() => {
                      setDueDateInput('');
                      onUpdateReminder({ dueDate: null });
                    }}
                  >
                    <Text style={styles.dueDateButtonText}>{t('Remover')}</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Pressable style={styles.dueDateButton} onPress={() => onConfirmDelete(project)}>
              <Text style={[styles.dueDateButtonText, { color: colors.acento }]}>
                {t('Apagar projeto')}
              </Text>
            </Pressable>
          </>
        ) : historyLog.length > 0 ? (
          [...historyLog].reverse().map((op) => (
            <View key={op.id} style={styles.historyRow}>
              <Text style={styles.historyTime}>{timeFormatter.format(new Date(op.timestamp))}</Text>
              <Text style={styles.historyAction}>{describeOperation(op)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {t('Nenhuma edição registrada ainda para este projeto.')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
