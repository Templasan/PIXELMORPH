import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useStore } from '@core/state';
import { colors, fontSize } from '@core/theme';
import App from './App';
import { AppCompositionRoot } from './CompositionRoot';
import { seedPreviewProjects } from '@/web-preview/seed';
import {
  PREVIEW_ACCOUNTS,
  previewAlert,
  previewState,
  type PreviewSyncResult,
} from '@/web-preview/state';

const { auth } = AppCompositionRoot.account;

Alert.alert = (title, message, buttons) => {
  previewAlert.set(() => ({
    title,
    message,
    buttons: buttons?.length ? ([...buttons] as never) : [{ text: 'OK' }],
  }));
};

function Chips<T>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { id: T; text: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {options.map((o) => (
        <Pressable
          key={o.text}
          style={[styles.chip, o.id === value && styles.chipOn]}
          onPress={() => onPick(o.id)}
        >
          <Text style={styles.chipText}>{o.text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Panel({ onReseed }: { onReseed: () => void }) {
  const { syncResult, width } = useStore(previewState);
  const account = useStore(auth.state, (s) => s.account);
  const signIn = (next: typeof account) =>
    auth.state.set((prev) => ({ ...prev, account: next, status: next ? 'signedIn' : 'signedOut' }));
  return (
    <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panel}>
      <Text style={styles.title}>Preview de design</Text>
      <Text style={styles.note}>Dados de exemplo. Nada sai do navegador.</Text>
      <Chips
        label="Largura"
        options={[360, 412, 480].map((id) => ({ id, text: `${id} px` }))}
        value={width}
        onPick={(w) => previewState.set((s) => ({ ...s, width: w }))}
      />
      <Chips
        label="Conta"
        options={[
          { id: 'none', text: 'Sem login' },
          { id: 'password', text: 'Com senha' },
          { id: 'google', text: 'Só Google' },
        ]}
        value={!account ? 'none' : account.hasPassword ? 'password' : 'google'}
        onPick={(id) =>
          signIn(id === 'none' ? null : PREVIEW_ACCOUNTS[id as 'password' | 'google'])
        }
      />
      <Chips<PreviewSyncResult>
        label="Resultado da sincronização"
        options={[
          { id: 'ok', text: 'Tudo em dia' },
          { id: 'sent', text: 'Enviou e recebeu' },
          { id: 'conflict', text: 'Conflito' },
          { id: 'offline', text: 'Servidor desligado' },
        ]}
        value={syncResult}
        onPick={(id) => previewState.set((s) => ({ ...s, syncResult: id }))}
      />
      <Pressable style={styles.chip} onPress={onReseed}>
        <Text style={styles.chipText}>Restaurar projetos de exemplo</Text>
      </Pressable>
    </ScrollView>
  );
}

function AlertHost() {
  const alert = useStore(previewAlert);
  if (!alert) return null;
  return (
    <View style={styles.veil}>
      <View style={styles.dialog}>
        <Text style={styles.dialogTitle}>{alert.title}</Text>
        {alert.message ? <Text style={styles.dialogMessage}>{alert.message}</Text> : null}
        <View style={styles.dialogButtons}>
          {alert.buttons.map((b) => (
            <Pressable
              key={b.text}
              onPress={() => {
                previewAlert.set(() => null);
                b.onPress?.();
              }}
            >
              <Text style={styles.dialogButton}>{b.text}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Web design preview: the real app in a phone-sized column, with sample data (docs/web-preview.md). */
export default function Root() {
  const [generation, setGeneration] = useState(0);
  const [ready, setReady] = useState(false);
  const { width } = useStore(previewState);
  const window = useWindowDimensions();

  useEffect(() => {
    void seedPreviewProjects().then(() => setReady(true));
  }, []);

  if (!ready) return null;
  const roomForPanel = window.width >= 720;
  const reseed = () => void seedPreviewProjects(true).then(() => setGeneration((g) => g + 1));
  return (
    <View style={styles.page}>
      {roomForPanel && <Panel onReseed={reseed} />}
      <View style={[styles.phone, { width: Math.min(width, window.width) }]}>
        <App key={generation} />
        <AlertHost />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: '#0a0a0a',
  },
  phone: { height: '100%', overflow: 'hidden', backgroundColor: colors.canvas },
  panelScroll: { width: 220, flexGrow: 0 },
  panel: { padding: 16, gap: 16 },
  title: { color: colors.texto, fontSize: fontSize.md, fontWeight: '600' },
  note: { color: colors.texto2, fontSize: fontSize.xs },
  group: { gap: 6 },
  label: { color: colors.texto2, fontSize: fontSize.xs },
  chip: { borderWidth: 1, borderColor: colors.linha, paddingVertical: 6, paddingHorizontal: 10 },
  chipOn: { borderColor: colors.acento },
  chipText: { color: colors.texto, fontSize: fontSize.xs },
  veil: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dialog: { width: '100%', maxWidth: 320, padding: 20, gap: 12, backgroundColor: colors.painel },
  dialogTitle: { color: colors.texto, fontSize: fontSize.md, fontWeight: '600' },
  dialogMessage: { color: colors.texto2, fontSize: fontSize.sm },
  dialogButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 16 },
  dialogButton: { color: colors.acento, fontSize: fontSize.sm, fontWeight: '600' },
});
