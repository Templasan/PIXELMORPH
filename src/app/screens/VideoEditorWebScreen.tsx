import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@core/i18n';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { usePersistedHistory } from '@core/history';
import { errorLogger } from '@core/reliability';
import { MEDIA_DIR_NAME } from '@core/reliability/storageUsage';
import { colors } from '@core/theme';
import type { Track } from '@modules/video-editor';
import {
  copyToAppStorage,
  pickAudioFromDevice,
  pickFromGallery,
  pickMultipleImagesFromGallery,
  probeVideoDurationMs,
} from '@modules/device-media';
import {
  cancelSpeech,
  detectFaces,
  extractFrame,
  speechModelReady,
  transcribeSpeech,
  type DetectedFace,
} from '../../../modules/pixelmorph-video-export/src';
import { useAppModules } from '../hooks';
import { useEditorRecovery } from './useEditorRecovery';
import { motionFileOf } from './camera/motionRecorder';
import { buildInitialTracks } from './video-editor/initialTracks';
import { createFileHost } from './video-editor/web-engine/fileHost';
import {
  awaitExportCopies,
  proxyStore,
  requestSourceProxy,
  sourcesReadiness,
} from './video-editor/previewProxy';
import { proxyKey } from './video-editor/previewTier';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoEditor'>;

/** The web editor, built by `npm run build:app` in video-editor-web into the APK's assets. */
const EDITOR_URL = 'file:///android_asset/video-editor/index.html';
/** RF-016: enough to find a face, and quick to read. */
const FACE_FRAME_WIDTH = 720;

interface SavedProject {
  name: string;
  tracks: Track[];
  format?: string;
}

/**
 * The video editor (video-editor-web/) inside a WebView. This screen is its host: the page asks
 * for media, the project, file reads and the export through the bridge, and the app answers with
 * its own services (gallery picker, project files, expo-file-system, the photo library).
 */
export default function VideoEditorWebScreen({ navigation, route }: Props) {
  const projectId = route.params?.projectId;
  const start = route.params?.start ?? '';
  const { projects } = useAppModules();
  const insets = useSafeAreaInsets();
  const { language } = useI18n();
  const webRef = useRef<WebView>(null);
  const { editorKey, onRenderProcessGone } = useEditorRecovery(navigation.goBack);
  const files = useMemo(createFileHost, []);
  // Edits made with the old editor live in its undo log: the first open replays them.
  const history = usePersistedHistory(projectId ?? 'unsaved-video-session');
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => () => files.close(), [files]);

  // Preview copies: the editor names its video files; finished 720p proxies are pushed to it
  // (now and whenever another one is ready). The export keeps reading the originals.
  const facesCancelled = useRef(false);
  const wanted = useRef<string[]>([]);
  const lowEnd = useRef(false);
  const lastMap = useRef('');
  const lastPreparing = useRef<number | null | undefined>(undefined);
  const pushProxies = useCallback(() => {
    const state = proxyStore.get();
    // How far the copies the page will read are: it shows a badge until they are ready.
    // Still 'checking' says nothing yet: most files need no copy, and the badge would just flash.
    const keys = wanted.current
      .map((uri) => (lowEnd.current ? proxyKey(uri, '540') : proxyKey(uri, '720')))
      .filter((key) => state[key]?.status === 'pending' || state[key]?.status === 'running');
    const readiness = sourcesReadiness(state, keys);
    const preparing = readiness.ready ? null : Math.round(readiness.progress);
    if (preparing !== lastPreparing.current) {
      lastPreparing.current = preparing;
      webRef.current?.injectJavaScript(
        `window.__pmEvent && window.__pmEvent({type:'previewPreparing',progress:${preparing}});true;`
      );
    }
    const map: Record<string, string> = {};
    for (const uri of wanted.current) {
      // A low-end phone takes the lightest copy once there is one, and the usual one until then.
      const light = lowEnd.current ? state[proxyKey(uri, '540')] : undefined;
      const entry = light?.status === 'ready' ? light : state[uri];
      if (entry?.status === 'ready' && entry.uri) map[uri] = entry.uri;
    }
    const json = JSON.stringify(map);
    if (json === lastMap.current) return;
    lastMap.current = json;
    webRef.current?.injectJavaScript(
      `window.__pmEvent && window.__pmEvent({type:'previewSources',map:${json}});true;`
    );
  }, []);
  useEffect(() => proxyStore.subscribe(pushProxies), [pushProxies]);

  const timelineFile = projectId
    ? `${FileSystem.documentDirectory}${MEDIA_DIR_NAME}/${projectId}/timeline.json`
    : null;

  const handlers = useMemo<Record<string, (...args: never[]) => Promise<unknown>>>(
    () => ({
      readMotion: (uri: string) =>
        FileSystem.readAsStringAsync(motionFileOf(uri)).catch(() => null),
      async sampleFaces(uri: string, inMs: number, outMs: number, stepMs: number) {
        facesCancelled.current = false;
        const samples: { ms: number; faces: DetectedFace[] }[] = [];
        const total = Math.max(1, Math.ceil((outMs - inMs) / stepMs));
        for (let i = 0; i < total; i += 1) {
          if (facesCancelled.current) throw new Error('CANCELLED');
          const ms = inMs + i * stepMs;
          const frame = await extractFrame(uri, Math.round(ms), FACE_FRAME_WIDTH);
          try {
            samples.push({ ms, faces: await detectFaces(frame.uri) });
          } finally {
            await FileSystem.deleteAsync(frame.uri, { idempotent: true }).catch(() => {});
          }
          const percent = Math.round(((i + 1) / total) * 100);
          webRef.current?.injectJavaScript(
            `window.__pmEvent && window.__pmEvent({type:'faceProgress',percent:${percent}});true;`
          );
        }
        return samples;
      },
      cancelFaces: async () => {
        facesCancelled.current = true;
      },
      speechModelReady: async () => speechModelReady(),
      transcribeSpeech: (uri: string, inMs: number, outMs: number) =>
        transcribeSpeech(uri, inMs, outMs, (progress) => {
          webRef.current?.injectJavaScript(
            `window.__pmEvent && window.__pmEvent(${JSON.stringify({ type: 'speechProgress', ...progress })});true;`
          );
        }),
      cancelSpeech: async () => cancelSpeech(),

      async pickMedia(kind: 'video' | 'image' | 'audio', multiple = false) {
        if (kind === 'audio') {
          const picked = await pickAudioFromDevice();
          if (!picked) return [];
          return [
            {
              name: picked.fileName,
              kind,
              uri: await copyToAppStorage(picked.uri, picked.fileName, projectId),
            },
          ];
        }
        if (kind === 'image' && multiple) {
          // RF-023 time-lapse: several photos at once, each copied into the project's folder.
          const all = await pickMultipleImagesFromGallery();
          const items = [];
          for (const p of all) {
            items.push({
              name: p.fileName ?? 'Foto',
              kind,
              uri: await copyToAppStorage(p.uri, p.fileName, projectId),
            });
          }
          return items;
        }
        const picked = await pickFromGallery([kind === 'video' ? 'videos' : 'images']);
        if (!picked) return [];
        const name = picked.fileName ?? (kind === 'video' ? 'Vídeo' : 'Foto');
        // The picker hands back a cache copy; the timeline must reference a permanent one.
        return [
          { name, kind, uri: await copyToAppStorage(picked.uri, picked.fileName, projectId) },
        ];
      },

      async loadProject(): Promise<SavedProject | null> {
        if (timelineFile) {
          const info = await FileSystem.getInfoAsync(timelineFile);
          if (info.exists) return JSON.parse(await FileSystem.readAsStringAsync(timelineFile));
        }
        let project = projectId ? await projects.getProject.execute(projectId) : null;
        // Some projects never stored their video's length; the timeline then made it 10 s.
        const asset = project?.assets[0];
        if (project && asset?.type === 'video' && !asset.metadata.durationMs) {
          const durationMs = await probeVideoDurationMs(asset.workingUri || asset.originalUri);
          if (durationMs) {
            project = {
              ...project,
              assets: [
                { ...asset, metadata: { ...asset.metadata, durationMs } },
                ...project.assets.slice(1),
              ],
            };
          }
        }
        while (!historyRef.current.ready) await new Promise((r) => setTimeout(r, 50));
        const seeded = buildInitialTracks(project);
        const state = historyRef.current.reconstructState({ tracks: seeded } as unknown as Record<
          string,
          unknown
        >);
        return { name: project?.name ?? 'Novo projeto', tracks: state.tracks as Track[] };
      },

      async saveProject(project: SavedProject) {
        if (!timelineFile) return;
        await FileSystem.makeDirectoryAsync(timelineFile.replace(/[^/]+$/, ''), {
          intermediates: true,
        });
        await FileSystem.writeAsStringAsync(timelineFile, JSON.stringify(project));
      },

      async exportStart(fileName: string) {
        await files.startExport(fileName.split('.').pop() ?? 'mp4');
      },
      async exportWrite(position: number, b64: string) {
        await files.writeExportChunk(position, b64);
      },
      async exportFinish() {
        const uri = await files.finishExport();
        const permission = await MediaLibrary.requestPermissionsAsync(true); // write only: saving needs no read access
        if (!permission.granted) return 'Pronto, mas sem permissão para salvar na galeria.';
        await MediaLibrary.createAssetAsync(uri);
        return 'Salvo na galeria.';
      },

      getFileSize: (uri: string) => files.getFileSize(uri),
      readChunk: (uri: string, offset: number, length: number) =>
        files.readChunk(uri, offset, length),

      async close() {
        navigation.goBack();
      },

      async wantPreviewSources(uris: string[], low = false) {
        wanted.current = uris;
        lowEnd.current = low;
        for (const uri of uris) void requestSourceProxy(uri, low ? '540' : '720');
        pushProxies();
      },

      /** Export fallback: the page waits for these 1080p copies, and gets their progress as events. */
      exportCopies: (uris: string[]) =>
        awaitExportCopies(uris, (pct) => {
          webRef.current?.injectJavaScript(
            `window.__pmEvent && window.__pmEvent({type:'exportCopiesProgress',progress:${Math.round(pct)}});true;`
          );
        }),
    }),
    [files, navigation, projectId, projects, timelineFile, pushProxies]
  );

  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let id = 0;
      try {
        const msg = JSON.parse(event.nativeEvent.data) as {
          id: number;
          method: string;
          args: never[];
        };
        id = msg.id;
        const handler = handlers[msg.method];
        if (!handler) throw new Error(`unknown method ${msg.method}`);
        const result = await handler(...msg.args);
        reply(id, { result: result ?? null });
      } catch (error) {
        if (!(error instanceof Error && error.message === 'PERMISSION_DENIED')) {
          errorLogger.log(error, 'VideoEditorWebScreen.bridge');
        }
        if (error instanceof Error && error.message === 'PERMISSION_DENIED') {
          Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para adicionar mídia.');
        }
        reply(id, { error: error instanceof Error ? error.message : String(error) });
      }
    },
    [handlers]
  );

  function reply(id: number, payload: { result?: unknown; error?: string }) {
    webRef.current?.injectJavaScript(
      `window.__pmReply && window.__pmReply(${JSON.stringify({ id, ...payload })});true;`
    );
  }

  // The page draws edge to edge: give it the system bars' sizes before it lays out.
  // The editor's UI language (RNF-016), read once by the page before it draws.
  const insetsScript = `(function(){window.__pmLanguage='${language}';window.__pmStart='${start}';var s=document.documentElement.style;s.setProperty('--safe-top','${insets.top}px');s.setProperty('--safe-bottom','${insets.bottom}px');})();true;`;

  return (
    <View style={styles.container}>
      <WebView
        key={editorKey}
        ref={webRef}
        onRenderProcessGone={onRenderProcessGone}
        source={{ uri: EDITOR_URL }}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        mediaPlaybackRequiresUserAction={false}
        injectedJavaScriptBeforeContentLoaded={insetsScript}
        onMessage={onMessage}
        // chrome://inspect on the PC can attach to the editor (development and measuring).
        webviewDebuggingEnabled
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  web: { flex: 1, backgroundColor: colors.canvas },
});
