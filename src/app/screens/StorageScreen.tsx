import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, SideDrawer, Switch } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { errorLogger } from '@core/reliability';
import {
  clearCache,
  formatBytes,
  getStorageUsage,
  type StorageUsage,
} from '@core/reliability/storageUsage';
import { useI18n } from '@core/i18n';
import { useAppModules } from '../hooks';
import { AUTO_BACKUP_KEY, LAST_BACKUP_KEY } from '@modules/projects';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Storage'>;

const SEGMENT_COLORS = [colors.acento, colors.ok, colors.alerta, '#8E5FB9', colors.perigo];

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

export default function StorageScreen({ navigation }: Props) {
  const { projects } = useAppModules();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useI18n();
  const [backupEnabled, setBackupEnabledState] = useState(true);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [reportsEnabled, setReportsEnabled] = useState(true);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);

  const refresh = useCallback(async () => {
    setUsage(await getStorageUsage());
    setLastBackupAt(Number(await AsyncStorage.getItem(LAST_BACKUP_KEY)) || null);
    setBackupEnabledState((await AsyncStorage.getItem(AUTO_BACKUP_KEY)) !== '0');
    setReportsEnabled(await errorLogger.isReportingEnabled());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const setBackupEnabled = async (value: boolean) => {
    setBackupEnabledState(value);
    await AsyncStorage.setItem(AUTO_BACKUP_KEY, value ? '1' : '0');
  };

  const handleReportsToggle = (value: boolean) => {
    setReportsEnabled(value);
    errorLogger.reportPending(value);
  };

  const handleClearLogs = async () => {
    await errorLogger.clear();
    refresh();
  };

  const handleClearCache = async () => {
    await clearCache();
    refresh();
  };

  const categories = usage
    ? [
        { icon: 'folder', label: 'Projetos', bytes: usage.projectsBytes, action: null },
        { icon: 'image', label: 'Histórico de edições', bytes: usage.historyBytes, action: null },
        {
          icon: 'film',
          label: 'Cache de pré-visualização',
          bytes: usage.cacheBytes,
          action: { label: 'Limpar', run: handleClearCache },
        },
        { icon: 'save', label: 'Backups', bytes: usage.backupsBytes, action: null },
        {
          icon: 'info',
          label: 'Registros de erro',
          bytes: usage.logBytes,
          action: { label: 'Limpar', run: handleClearLogs },
        },
      ]
    : [];
  const errorLogSize = usage?.logBytes ?? 0;

  const handleVerifyIntegrity = async () => {
    setCheckingIntegrity(true);
    try {
      const results = await projects.repository.verifyAllIntegrity();
      const restored = results.filter((r) => r.result === 'restored');
      const unrecoverable = results.filter((r) => r.result === 'unrecoverable');

      if (restored.length === 0 && unrecoverable.length === 0) {
        Alert.alert(
          t('Integridade verificada'),
          t('{n} projeto(s) verificado(s). Nenhum problema encontrado.', { n: results.length })
        );
      } else {
        const lines = [
          restored.length > 0 ? t('{n} restaurado(s) do backup.', { n: restored.length }) : null,
          unrecoverable.length > 0
            ? t('{n} não puderam ser recuperados.', { n: unrecoverable.length })
            : null,
        ].filter(Boolean);
        Alert.alert(t('Integridade verificada'), lines.join('\n'));
      }
    } catch (error) {
      await errorLogger.log(error, 'verifyAllIntegrity');
      Alert.alert(t('Erro'), t('Não foi possível verificar a integridade dos projetos agora.'));
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
        <Text style={styles.topBarTitle}>{t('Armazenamento')}</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <View style={styles.usageSection}>
          <Text style={styles.usageText}>
            {usage
              ? t('{used} usados pelo app · {free} livres no aparelho', {
                  used: formatBytes(usage.usedBytes),
                  free: formatBytes(usage.freeDiskBytes),
                })
              : '…'}
          </Text>
          <View style={styles.segmentBar}>
            {categories.map((cat, i) => (
              <View
                key={cat.label}
                style={{
                  flex: Math.max(cat.bytes, 1),
                  backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                }}
              />
            ))}
          </View>
          <View style={styles.legendRow}>
            {categories.map((cat, i) => (
              <View key={cat.label} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] },
                  ]}
                />
                <Text style={styles.legendText}>{t(cat.label)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          {categories.map((cat) => (
            <View key={cat.label} style={styles.categoryRow}>
              <Icon name={cat.icon} size={18} />
              <Text style={styles.categoryLabel}>{t(cat.label)}</Text>
              <Text style={styles.categorySize}>{formatBytes(cat.bytes)}</Text>
              {cat.action && (
                <Pressable onPress={cat.action.run}>
                  <Text style={styles.categoryAction}>{t(cat.action.label)}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <SectionHeader label={t('BACKUP')} />
        <View style={styles.bordered}>
          <View style={styles.backupRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('Backup automático')}</Text>
              <Text style={styles.rowSub}>
                {lastBackupAt
                  ? t('Último backup: {when}', {
                      when: new Date(lastBackupAt).toLocaleString('pt-BR'),
                    })
                  : t('Nenhum backup ainda')}
              </Text>
            </View>
            <Switch value={backupEnabled} onChange={setBackupEnabled} />
          </View>
          <Pressable
            style={styles.integrityButton}
            onPress={handleVerifyIntegrity}
            disabled={checkingIntegrity}
          >
            <Text style={styles.integrityButtonText}>
              {checkingIntegrity ? t('Verificando…') : t('Verificar integridade dos projetos')}
            </Text>
          </Pressable>
        </View>

        <SectionHeader label={t('DIAGNÓSTICO')} />
        <View style={styles.bordered}>
          <View style={styles.diagRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('Registros locais')}</Text>
              <Text style={styles.rowSub}>
                {formatBytes(errorLogSize)} · {t('limite de 5 MB com rotação automática')}
              </Text>
            </View>
            <Pressable onPress={handleClearLogs}>
              <Text style={styles.categoryAction}>{t('Limpar')}</Text>
            </Pressable>
          </View>
          <View style={styles.diagRowLast}>
            <Text style={styles.rowLabelFlex}>{t('Enviar relatórios anonimamente')}</Text>
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
