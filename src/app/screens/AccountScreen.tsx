import { ReactNode, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppCompositionRoot } from '../CompositionRoot';
import { Icon } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { LANGUAGES, useI18n } from '@core/i18n';
import { useStore } from '@core/state';
import { CloudError } from '@modules/projects';
import { joinSentences, pendingUploadsSentence } from './accountSentences';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

const { auth } = AppCompositionRoot.account;
const sync = AppCompositionRoot.sync;
type SyncPrepared = Awaited<ReturnType<typeof sync.prepare>>;
type SyncReport = Awaited<ReturnType<typeof sync.run>>;
type SyncConflict = SyncPrepared['conflicts'][number];
type Translate = (text: string, params?: Record<string, string | number>) => string;

/** A count with the noun in its right form: "1 projeto", "3 projetos". */
function counted(
  n: number,
  one: string,
  many: string,
  t: Translate,
  params: Record<string, string | number> = {}
): string {
  return n === 1 ? t(one, params) : t(many, { ...params, n });
}

/** Up to three project names, then how many more there are. */
function projectNames(names: string[], t: Translate): string {
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  if (rest > 0) {
    const head = shown.join(', ');
    return rest === 1
      ? t('{names} e mais 1 projeto', { names: head })
      : t('{names} e mais {n} projetos', { names: head, n: rest });
  }
  if (shown.length <= 1) return shown[0] ?? '';
  return t('{a} e {b}', { a: shown.slice(0, -1).join(', '), b: shown[shown.length - 1] });
}

/** The report line: what moved, then what needs attention. Each sentence ends with a period. */
function describeSync(r: SyncReport, t: Translate): string {
  const moved: string[] = [];
  if (r.uploaded) {
    moved.push(counted(r.uploaded, '1 projeto enviado', '{n} projetos enviados', t));
  }
  if (r.filesUploaded) {
    moved.push(counted(r.filesUploaded, '1 arquivo enviado', '{n} arquivos enviados', t));
  }
  if (r.downloaded) {
    moved.push(counted(r.downloaded, '1 projeto recebido', '{n} projetos recebidos', t));
  }
  if (r.filesDownloaded) {
    moved.push(counted(r.filesDownloaded, '1 arquivo recebido', '{n} arquivos recebidos', t));
  }
  // Whole sentences of their own: their text ends with a period, so they cannot sit in the comma list.
  const removed: string[] = [];
  if (r.tombstoned) {
    removed.push(counted(r.tombstoned, '1 removido da conta.', '{n} removidos da conta.', t));
  }
  if (r.removedElsewhere) {
    removed.push(
      counted(
        r.removedElsewhere,
        '1 removido da conta em outro aparelho: mantido aqui.',
        '{n} removidos da conta em outro aparelho: mantidos aqui.',
        t
      )
    );
  }

  const issues: string[] = [];
  if (r.serverForbidden) issues.push(t('Sua conta não tem acesso ao servidor de mídia.'));
  if (r.conflicts.length) {
    issues.push(
      counted(
        r.conflicts.length,
        '1 em conflito: mantido como está ({names}).',
        '{n} em conflito: mantidos como estão ({names}).',
        t,
        { names: r.conflicts.join(', ') }
      )
    );
  }
  if (r.pendingUploads) issues.push(pendingUploadsSentence(r.pendingUploads, r.serverOffline, t));
  if (r.pendingDownloads) {
    issues.push(
      counted(
        r.pendingDownloads,
        '1 projeto aguardando arquivos do servidor.',
        '{n} projetos aguardando arquivos do servidor.',
        t
      )
    );
  }
  if (r.failed) {
    issues.push(
      counted(
        r.failed,
        '1 projeto com erro, tentar de novo depois.',
        '{n} projetos com erro, tentar de novo depois.',
        t
      )
    );
  }
  // Missing files are reported even when nothing else needs attention ("Tudo em dia." comes first).
  const missing = r.missingFiles
    ? counted(
        r.missingFiles,
        '1 arquivo não encontrado neste aparelho ({names}).',
        '{n} arquivos não encontrados neste aparelho ({names}).',
        t,
        { names: projectNames(r.missingProjects, t) }
      )
    : '';

  const sentences = [moved.join(', '), ...removed].filter(Boolean);
  if (!sentences.length && !issues.length) sentences.push(t('Tudo em dia.'));
  return joinSentences([...sentences, ...issues, missing]);
}

function syncFailure(error: unknown, t: Translate): string {
  return error instanceof CloudError && error.kind === 'unauthorized'
    ? t('Entre na conta de novo para sincronizar.')
    : t('Não foi possível sincronizar agora.');
}

function SectionHeader({ label }: { label: string }) {
  const { t } = useI18n();
  return <Text style={styles.sectionHeader}>{t(label)}</Text>;
}

function ArrowRow({
  label,
  value,
  sub,
  onPress,
}: {
  label: string;
  value?: string;
  sub?: string;
  onPress?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Pressable style={[styles.row, sub && styles.rowTall]} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{t(label)}</Text>
        {sub && <Text style={styles.rowSub}>{t(sub)}</Text>}
      </View>
      {value && <Text style={styles.rowValue}>{t(value)}</Text>}
      <Icon name="chevronRight" size={16} color={colors.linha} />
    </Pressable>
  );
}

function Bordered({ children }: { children: ReactNode }) {
  return <View style={styles.bordered}>{children}</View>;
}

export default function AccountScreen({ navigation }: Props) {
  const { t, language, changeLanguage } = useI18n();
  const account = useStore(auth.state, (s) => s.account);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [syncLine, setSyncLine] = useState<string | null>(null);
  // A ref, not state: a second tap in the same frame must not start a second run.
  const syncBusy = useRef(false);

  const endSync = () => {
    syncBusy.current = false;
    setSyncProgress(null);
  };

  const settle = (userId: string, id: string, choice: 'local' | 'remote') =>
    sync
      .resolveConflict(userId, id, choice)
      .then((report) => setSyncLine(describeSync(report, t)))
      .catch((error) => setSyncLine(syncFailure(error, t)));

  // One alert per conflicting project, in turn. "Decidir depois" leaves it for the next sync.
  const askConflict = (userId: string, c: SyncConflict): Promise<void> =>
    new Promise((next) => {
      const ask = () =>
        Alert.alert(
          'PixelMorph',
          t('{name} foi alterado neste aparelho e em outro.', { name: c.name }),
          [
            {
              text: t('Manter este aparelho'),
              onPress: () => void settle(userId, c.id, 'local').then(next),
            },
            { text: t('Usar o da conta'), onPress: confirmRemote },
            { text: t('Decidir depois'), style: 'cancel', onPress: () => next() },
          ],
          { cancelable: false }
        );
      const confirmRemote = () =>
        Alert.alert(
          'PixelMorph',
          t('As edições deste aparelho nesse projeto serão substituídas.'),
          [
            { text: t('Cancelar'), style: 'cancel', onPress: ask },
            {
              text: t('Usar o da conta'),
              onPress: () => void settle(userId, c.id, 'remote').then(next),
            },
          ],
          { cancelable: false }
        );
      ask();
    });

  const execute = async (userId: string, prepared: SyncPrepared) => {
    try {
      const report = await sync.run(userId, prepared, (done, total) =>
        setSyncProgress(`${done}/${total}`)
      );
      setSyncLine(describeSync(report, t));
      for (const c of prepared.conflicts) await askConflict(userId, c);
    } catch (error) {
      setSyncLine(syncFailure(error, t));
    } finally {
      endSync();
    }
  };

  // Manual only: runs when the user taps the row, never on its own.
  const startSync = async (userId: string) => {
    if (syncBusy.current) return;
    syncBusy.current = true;
    setSyncLine(null);
    setSyncProgress('…');
    let prepared: SyncPrepared;
    try {
      prepared = await sync.prepare(userId);
    } catch (error) {
      setSyncLine(syncFailure(error, t));
      endSync();
      return;
    }
    if (prepared.firstTimeUploadCount > 0) {
      Alert.alert(
        'PixelMorph',
        t('Enviar {n} projetos para sua conta? As mídias vão para o seu servidor.', {
          n: prepared.firstTimeUploadCount,
        }),
        [
          { text: t('Cancelar'), style: 'cancel', onPress: endSync },
          { text: t('Enviar'), onPress: () => void execute(userId, prepared) },
        ],
        { cancelable: false }
      );
      return;
    }
    await execute(userId, prepared);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.navigate('Projects')} hitSlop={8}>
          <Icon name="chevronLeft" size={22} />
        </Pressable>
        <Text style={styles.topBarTitle}>{t('Conta e preferências')}</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <SectionHeader label="CONTA" />
        <Bordered>
          {account ? (
            <>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{account.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {account.name}
                  </Text>
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {account.email}
                  </Text>
                </View>
              </View>
              <ArrowRow label="Alterar senha" onPress={() => navigation.navigate('NewPassword')} />
            </>
          ) : (
            <ArrowRow
              label="Entrar ou criar conta"
              sub="Opcional: o app funciona sem conta"
              onPress={() => navigation.navigate('Login')}
            />
          )}
        </Bordered>

        {account && (
          <>
            <SectionHeader label="SINCRONIZAÇÃO" />
            <Bordered>
              <ArrowRow
                label="Sincronizar agora"
                value={syncProgress ?? undefined}
                onPress={syncProgress ? undefined : () => void startSync(account.id)}
              />
              {syncLine && <Text style={styles.syncLine}>{syncLine}</Text>}
            </Bordered>
          </>
        )}

        <SectionHeader label="IDIOMA" />
        <View style={styles.bordered}>
          {LANGUAGES.map((l) => (
            <Pressable
              key={l.code}
              style={styles.row}
              onPress={() => changeLanguage(l.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: language === l.code }}
            >
              <Text style={styles.rowLabelFlex}>{l.label}</Text>
              {language === l.code && <Icon name="check" size={18} color={colors.acento} />}
            </Pressable>
          ))}
        </View>

        <SectionHeader label="SOBRE" />
        <Bordered>
          <View style={styles.versionRow}>
            <Text style={styles.rowLabelFlex}>{t('Versão')}</Text>
            <Text style={styles.versionValue}>2.4.1</Text>
          </View>
          {account && (
            <Pressable style={styles.signOutButton} onPress={() => void auth.signOut()}>
              <Text style={styles.signOutText}>{t('Sair da conta')}</Text>
            </Pressable>
          )}
        </Bordered>
      </ScrollView>
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
    paddingTop: 16,
    paddingBottom: 6,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.texto2,
  },
  bordered: {
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.branco,
  },
  profileName: {
    fontSize: fontSize.lg,
    color: colors.texto,
    fontWeight: '500',
  },
  profileEmail: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    gap: 8,
  },
  rowTall: {
    paddingVertical: 10,
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  rowLabelFlex: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  rowSub: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginTop: 2,
  },
  rowValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  syncLine: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.texto2,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  languageNote: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  languageNoteText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    lineHeight: 18,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  versionValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  signOutButton: {
    margin: 16,
    marginBottom: 24,
    height: 44,
    borderWidth: 1,
    borderColor: colors.perigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.perigo,
  },
});
