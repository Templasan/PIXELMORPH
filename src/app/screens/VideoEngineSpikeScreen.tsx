import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library/legacy';
import { File, FileMode, Paths, type FileHandle } from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '@core/theme';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { buildSpikeScene } from '../../modules/video-editor/domain/webScene';
import { STICKER_DATA_URI } from './video-editor/web-engine/stickerData';
import WebEngine from './video-editor/web-engine/WebEngine';
import type { EngineCommand } from './video-editor/web-engine/WebEngine';
import type { FileMode as FileAccessMode } from './video-editor/web-engine/engine';

/**
 * SPIKE (docs/spike-webview.md): the video editor's scene drawn and exported by a WebCodecs
 * engine in a WebView. This screen is the RN host: file access, export file writing, metrics.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'VideoEngineSpike'>;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

const MODES: FileAccessMode[] = ['auto', 'xhr', 'bridge'];

const NEEDS_WEBVIEW_PREFIX = 'O motor de vídeo precisa';
const WEBVIEW_PACKAGE = 'com.google.android.webview';

/** Opens Android System WebView in the Play Store app, or on the web when there is no Play Store. */
async function openWebViewUpdate() {
  try {
    await Linking.openURL(`market://details?id=${WEBVIEW_PACKAGE}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${WEBVIEW_PACKAGE}`);
  }
}

export default function VideoEngineSpikeScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [status, setStatus] = useState('carregando...');
  const [metricsText, setMetricsText] = useState('{}');
  const [command, setCommand] = useState<EngineCommand>({ id: 0, type: 'pause' });
  const [fileMode, setFileMode] = useState<FileAccessMode>('auto');
  const [appState, setAppState] = useState(AppState.currentState);
  const metrics = useRef<Record<string, unknown>>({});
  const stamp = useRef(Date.now());
  const handles = useRef(new Map<string, FileHandle>());
  const exportFile = useRef<{ file: File; handle: FileHandle } | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  useEffect(
    () => () => {
      handles.current.forEach((h) => h.close());
      handles.current.clear();
    },
    []
  );

  const scene = useMemo(
    () => buildSpikeScene(route.params.tracks, { stickerDataUri: STICKER_DATA_URI }),
    [route.params.tracks]
  );

  const readChunk = useCallback(async (uri: string, offset: number, length: number) => {
    let h = handles.current.get(uri);
    if (!h) {
      h = new File(uri).open(FileMode.ReadOnly);
      handles.current.set(uri, h);
    }
    h.offset = offset;
    return toBase64(h.readBytes(length));
  }, []);

  const getFileSize = useCallback(async (uri: string) => new File(uri).size ?? 0, []);

  const startExport = useCallback(async () => {
    const file = new File(Paths.cache, `spike-export-${Date.now()}.mp4`);
    file.create({ overwrite: true });
    exportFile.current = { file, handle: file.open(FileMode.WriteOnly) };
  }, []);

  const writeExportChunk = useCallback(async (position: number, b64: string) => {
    const h = exportFile.current?.handle;
    if (!h) throw new Error('export not started');
    h.offset = position;
    h.writeBytes(fromBase64(b64));
  }, []);

  const finishExport = useCallback(async () => {
    const cur = exportFile.current;
    if (!cur) throw new Error('export not started');
    cur.handle.close();
    exportFile.current = null;
    console.log('[webengine-export]', cur.file.uri, cur.file.size);
    // Spike only: a copy in the media store so the PC can pull it (release builds have no run-as).
    try {
      await MediaLibrary.requestPermissionsAsync();
      const asset = await MediaLibrary.createAssetAsync(cur.file.uri);
      console.log('[webengine-export] media store copy', asset.uri, asset.filename);
    } catch (e) {
      console.log('[webengine-export] media store copy failed', String(e));
    }
    return `${cur.file.uri} (${cur.file.size} bytes)`;
  }, []);

  const onMetrics = useCallback(async (json: string) => {
    const { section, data } = JSON.parse(json) as { section: string; data: unknown };
    metrics.current = { ...metrics.current, [section]: data };
    const text = JSON.stringify(metrics.current, null, 1);
    console.log('[webengine-metrics]', JSON.stringify({ section, data }));
    setMetricsText(text);
    try {
      const f = new File(Paths.document, `webengine-metrics-${stamp.current}.json`);
      f.create({ overwrite: true });
      f.write(text);
    } catch (e) {
      console.log('[webengine-metrics] file write failed', String(e));
    }
  }, []);

  // An old System WebView fails before our component runs (e.g. no Object.fromEntries on Chrome 69),
  // so the web side can never say so itself.
  useEffect(() => {
    const t = setTimeout(
      () =>
        setStatus((s) =>
          s === 'carregando...'
            ? 'O motor de vídeo precisa do Android System WebView atualizado (o motor não iniciou em 10 s)'
            : s
        ),
      10000
    );
    return () => clearTimeout(t);
  }, []);

  const onStatus = useCallback(async (text: string) => {
    console.log('[webengine-status]', text);
    setStatus(text);
  }, []);

  const send = (type: EngineCommand['type'], ms?: number) =>
    setCommand((c) => ({ id: c.id + 1, type, ms }));

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.btnText}>Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Motor web (teste)</Text>
        <Pressable
          onPress={() => setFileMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length])}
          hitSlop={8}
        >
          <Text style={styles.btnText}>arquivo: {fileMode}</Text>
        </Pressable>
      </View>
      {scene ? (
        <WebEngine
          dom={{
            style: { width, height: Math.round((width * 9) / 16) },
            webviewDebuggingEnabled: true,
          }}
          scene={scene}
          command={command}
          fileMode={fileMode}
          appState={appState}
          readChunk={readChunk}
          getFileSize={getFileSize}
          startExport={startExport}
          writeExportChunk={writeExportChunk}
          finishExport={finishExport}
          onMetrics={onMetrics}
          onStatus={onStatus}
        />
      ) : null}
      <Text style={styles.status}>{status}</Text>
      {status.startsWith(NEEDS_WEBVIEW_PREFIX) ? (
        <View style={styles.row}>
          <Button label="Atualizar o WebView na Play Store" onPress={openWebViewUpdate} />
        </View>
      ) : null}
      <View style={styles.row}>
        <Button label="Play" onPress={() => send('play')} />
        <Button label="Pause" onPress={() => send('pause')} />
        <Button label="Seek ×20" onPress={() => send('seekBench')} />
        <Button label="Exportar" onPress={() => send('export')} />
      </View>
      <ScrollView style={styles.metrics}>
        <Text selectable style={styles.metricsText}>
          {metricsText}
        </Text>
      </ScrollView>
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  status: { color: '#9f9', fontSize: 12, paddingHorizontal: 12, paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  button: { backgroundColor: '#333', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 },
  btnText: { color: '#fff', fontSize: 14 },
  metrics: { flex: 1, paddingHorizontal: 12 },
  metricsText: { color: '#ccc', fontSize: 10, fontFamily: 'monospace' },
});
