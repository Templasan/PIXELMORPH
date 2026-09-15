import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, SideDrawer, Switch } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { errorLogger } from '@core/reliability';
import { createProjectsModule } from '@modules/projects';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Storage'>;

// TODO: replace with real on-device storage usage.
const CATEGORIES = [
  { icon: 'folder', label: 'Projetos', size: '2,8 GB', action: null },
  { icon: 'image', label: 'Rascunhos', size: '410 MB', action: null },
  { icon: 'film', label: 'Cache de pré-visualização', size: '680 MB', action: 'Limpar' },
  { icon: 'download', label: 'Recursos extras', size: '340 MB', action: 'Gerenciar' },
  { icon: 'save', label: 'Backups', size: '120 MB', action: null },
  { icon: 'info', label: 'Registros de erro', size: '4,1 MB', action: 'Limpar' },
] as const;

const ON_DEMAND = [
  { label: 'Filtros artísticos', size: '140 MB' },
  { label: 'Overlays e texturas', size: '120 MB' },
  { label: 'Modelos de IA local', size: '80 MB' },
];

const SEGMENT_COLORS = [colors.acento, colors.ok, colors.alerta, '#8E5FB9', colors.perigo];
const SEGMENT_LABELS = ['Projetos', 'Rascunhos', 'Cache', 'Recursos', 'Outros'];
const SEGMENT_WIDTHS = [40, 8, 14, 7, 3];

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

export default function StorageScreen({ navigation }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [reportsEnabled, setReportsEnabled] = useState(true);
  const [errorLogSize, setErrorLogSize] = useState(0);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);

  useFocusEffect(
    useCallback(() => {
      errorLogger.getSizeBytes().then(setErrorLogSize);
    }, [])
  );

  const handleReportsToggle = (value: boolean) => {
    setReportsEnabled(value);
    errorLogger.reportPending(value);
  };

  const handleClearLogs = async () => {
    await errorLogger.clear();
    setErrorLogSize(0);
  };

  const handleVerifyIntegrity = async () => {
    setCheckingIntegrity(true);
    try {
      const { repository } = createProjectsModule();
      const results = await repository.verifyAllIntegrity();
      const restored = results.filter((r) => r.result === 'restored');
      const unrecoverable = results.filter((r) => r.result === 'unrecoverable');

      if (restored.length === 0 && unrecoverable.length === 0) {
        Alert.alert(
          'Integridade verificada',
          `${results.length} projeto(s) verificado(s). Nenhum problema encontrado.`
        );
      } else {
        const lines = [
          restored.length > 0 ? `${restored.length} restaurado(s) do backup.` : null,
          unrecoverable.length > 0 ? `${unrecoverable.length} não puderam ser recuperados.` : null,
        ].filter(Boolean);
        Alert.alert('Integridade verificada', lines.join('\n'));
      }
    } catch (error) {
      await errorLogger.log(error, 'verifyAllIntegrity');
      Alert.alert('Erro', 'Não foi possível verificar a integridade dos projetos agora.');
    } finally {
      setCheckingIntegrity(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setDrawerOpen(true)} hitSlop={8}>
          <Icon name="menu" size={22} />
        </Pressable>
        <Text style={styles.topBarTitle}>Armazenamento</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.usageSection}>
          <Text style={styles.usageText}>4,2 GB de 10 GB usados</Text>
          <View style={styles.segmentBar}>
            {SEGMENT_WIDTHS.map((w, i) => (
              <View key={i} style={{ width: `${w}%`, backgroundColor: SEGMENT_COLORS[i] }} />
            ))}
            <View style={styles.segmentRemainder} />
          </View>
          <View style={styles.legendRow}>
            {SEGMENT_LABELS.map((label, i) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SEGMENT_COLORS[i] }]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          {CATEGORIES.map((cat) => (
            <View key={cat.label} style={styles.categoryRow}>
              <Icon name={cat.icon} size={18} />
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <Text style={styles.categorySize}>{cat.size}</Text>
              {cat.action && (
                // TODO: implement clear-cache / manage-resources actions.
                <Pressable>
                  <Text style={styles.categoryAction}>{cat.action}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <SectionHeader label="RECURSOS SOB DEMANDA" />
        <View style={styles.onDemandSection}>
          <Text style={styles.onDemandIntro}>
            O app ocupa 180 MB na instalação. Filtros, overlays e modelos de IA são baixados
            conforme o uso.
          </Text>
          {ON_DEMAND.map((item) => (
            <View key={item.label} style={styles.onDemandRow}>
              <Text style={styles.onDemandLabel}>{item.label}</Text>
              <Text style={styles.onDemandSize}>{item.size}</Text>
              {/* TODO: implement remove-downloaded-resource action. */}
              <Pressable>
                <Text style={styles.removeText}>Remover</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <SectionHeader label="BACKUP" />
        <View style={styles.bordered}>
          <View style={styles.backupRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Backup automático</Text>
              {/* TODO: real last-backup timestamp. */}
              <Text style={styles.rowSub}>Último backup: hoje, 13:40</Text>
            </View>
            <Switch value={backupEnabled} onChange={setBackupEnabled} />
          </View>
          <Pressable
            style={styles.integrityButton}
            onPress={handleVerifyIntegrity}
            disabled={checkingIntegrity}
          >
            <Text style={styles.integrityButtonText}>
              {checkingIntegrity ? 'Verificando…' : 'Verificar integridade dos projetos'}
            </Text>
          </Pressable>
        </View>

        <SectionHeader label="DIAGNÓSTICO" />
        <View style={styles.bordered}>
          <View style={styles.diagRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Registros locais</Text>
              <Text style={styles.rowSub}>
                {formatBytes(errorLogSize)} · limite de 5 MB com rotação automática
              </Text>
            </View>
            <Pressable onPress={handleClearLogs}>
              <Text style={styles.categoryAction}>Limpar</Text>
            </Pressable>
          </View>
          <View style={styles.diagRowLast}>
            <Text style={styles.rowLabelFlex}>Enviar relatórios anonimamente</Text>
            <Switch value={reportsEnabled} onChange={handleReportsToggle} />
          </View>
        </View>
      </ScrollView>

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigation={navigation}
        current="Storage"
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
    height: 52,
    backgroundColor: colors.barra,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  topBarTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.texto,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.texto2,
  },
  usageSection: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  usageText: {
    fontSize: fontSize.md,
    color: colors.texto,
    marginBottom: 10,
  },
  segmentBar: {
    flexDirection: 'row',
    height: 12,
    gap: 1,
    marginBottom: 10,
  },
  segmentRemainder: {
    flex: 1,
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    columnGap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  categoryLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  categorySize: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  categoryAction: {
    marginLeft: 10,
    fontSize: fontSize.xs,
    color: colors.acento,
  },
  onDemandSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  onDemandIntro: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    lineHeight: 18,
    marginBottom: 10,
  },
  onDemandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    gap: 12,
  },
  onDemandLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  onDemandSize: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  removeText: {
    fontSize: fontSize.xs,
    color: colors.perigo,
  },
  bordered: {
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowLabel: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  rowLabelFlex: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  rowSub: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginTop: 2,
  },
  integrityButton: {
    marginHorizontal: 16,
    marginBottom: 14,
    height: 38,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  integrityButtonText: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  diagRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
});
