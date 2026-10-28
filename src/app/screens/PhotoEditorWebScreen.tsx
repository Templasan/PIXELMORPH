import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { LocalHistoryRepository, type Operation } from '@core/history';
import { errorLogger } from '@core/reliability';
import { colors } from '@core/theme';
import { encodeImage } from '@modules/export';
import {
  createPhotoEditorModule,
  loadEditorImages,
  loadLayers,
  rawFormatLabel,
  saveEditorImages,
  saveLayers,
  type EditorLayer,
} from '@modules/photo-editor';
import { copyToAppStorage, pickFromGallery } from '@modules/device-media';
import { useAppModules } from '../hooks';
import { createFileHost } from './video-editor/web-engine/fileHost';
import { loadFullImage } from './photo-editor/photoProxySkia';
import { lightCopyOf } from './photo-editor/lightCopy';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoEditor'>;

/** The web editor, built by `npm run build:app` in photo-editor-web into the APK's assets. */
const EDITOR_URL = 'file:///android_asset/photo-editor/index.html';

interface PictureRef {
  name: string;
  uri: string;
}

/** photo-editor-web's SavedPhoto (ports/host.ts); `history.undone` has the next redo last. */
interface SavedPhoto {
  name: string;
  photo: PictureRef & { format?: string; sizeBytes?: number; width?: number; height?: number };
  previewUri?: string;
  layers?: EditorLayer[];
  doubleExposure?: PictureRef | null;
  overlay?: PictureRef | null;
  history?: { done: Operation[]; undone: Operation[] };
}

/** The WebView cannot decode these: the page gets a full-size JPEG copy made with Skia. */
const NEEDS_JPEG_COPY = /heic|heif/i;

/** A JPEG copy of `uri` next to it (made once), for pictures the WebView cannot read. */
async function readableCopyOf(uri: string): Promise<string> {
  const copy = `${uri.replace(/\.[^./]+$/, '')}.full.jpg`;
  if ((await FileSystem.getInfoAsync(copy)).exists) return copy;
  const image = await loadFullImage(uri);
  if (!image) throw new Error('Não foi possível abrir esta foto.');
  try {
    const { base64 } = encodeImage(image, 'JPEG', 95);
    await FileSystem.writeAsStringAsync(`${copy}.tmp`, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.moveAsync({ from: `${copy}.tmp`, to: copy });
    return copy;
  } finally {
    image.dispose();
  }
}

/**
 * The photo editor (photo-editor-web/) inside a WebView. This screen is its host: it hands the
 * page the project's photo and its saved edits, and stores what the page saves in the same
 * places the app always used (edit history, layers, extra pictures), so the projects screen's
 * edit history and deleting a project keep working.
 */
export default function PhotoEditorWebScreen({ navigation, route }: Props) {
  const projectId = route.params?.projectId;
  const { projects } = useAppModules();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const files = useMemo(createFileHost, []);
  const historyRepo = useMemo(() => new LocalHistoryRepository(), []);

  useEffect(() => () => files.close(), [files]);

  const handlers = useMemo<Record<string, (...args: never[]) => Promise<unknown>>>(
    () => ({
      async loadProject(): Promise<SavedPhoto | null> {
        const project = projectId ? await projects.getProject.execute(projectId) : null;
        const asset = project?.assets[0];
        if (!project || !asset) return null;
        const uri = asset.workingUri || asset.originalUri;
        const mime = asset.metadata.mimeType;
        // The screen opens a small upright copy (made once); the export reads the original.
        const light = await lightCopyOf(uri);
        const [snapshot, layers, images] = await Promise.all([
          historyRepo.load(project.id).catch(() => null),
          loadLayers(project.id),
          loadEditorImages(project.id),
        ]);
        return {
          name: project.name,
          photo: {
            name: project.name,
            uri: NEEDS_JPEG_COPY.test(mime) ? await readableCopyOf(uri) : uri,
            format: rawFormatLabel(mime) ?? (mime.split('/')[1] ?? '').toUpperCase(),
            sizeBytes: asset.metadata.fileSizeBytes,
            width: light.width,
            height: light.height,
          },
          previewUri: light.uri,
          layers: layers ?? undefined,
          doubleExposure: images?.doubleExposure ?? null,
          overlay: images?.overlay ?? null,
          history: snapshot
            ? { done: snapshot.past, undone: [...snapshot.future].reverse() }
            : undefined,
        };
      },

      async saveProject(saved: SavedPhoto) {
        if (!projectId) return;
        await Promise.all([
          saved.layers ? saveLayers(projectId, saved.layers) : null,
          saveEditorImages(projectId, {
            doubleExposure: saved.doubleExposure ?? null,
            overlay: saved.overlay ?? null,
          }),
          saved.history
            ? historyRepo.save(projectId, {
                past: saved.history.done,
                future: [...saved.history.undone].reverse(),
              })
            : null,
        ]);
      },

      async pickPicture(): Promise<PictureRef | null> {
        const picked = await pickFromGallery(['images']);
        if (!picked) return null;
        // The picker hands back a cache copy; the project must reference a permanent one.
        const uri = await copyToAppStorage(picked.uri, picked.fileName, projectId);
        return {
          name: picked.fileName ?? 'Foto',
          uri: NEEDS_JPEG_COPY.test(picked.mimeType ?? uri) ? await readableCopyOf(uri) : uri,
        };
      },

      async listPresets() {
        const presets = await createPhotoEditorModule().listPresets.execute();
        return presets.map(({ id, name, adjustments }) => ({ id, name, adjustments }));
      },
      async savePreset(name: string, adjustments: Record<string, number>) {
        await createPhotoEditorModule().savePreset.execute(name, adjustments);
      },

      async exportStart(fileName: string) {
        await files.startExport(fileName.split('.').pop() ?? 'jpg');
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

      async close() {
        navigation.navigate('Projects');
      },
    }),
    [files, historyRepo, navigation, projectId, projects]
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
        const denied = error instanceof Error && error.message === 'PERMISSION_DENIED';
        if (denied)
          Alert.alert(
            'Permissão necessária',
            'Autorize o acesso à galeria para escolher uma foto.'
          );
        else errorLogger.log(error, 'PhotoEditorWebScreen.bridge');
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
  const insetsScript = `(function(){var s=document.documentElement.style;s.setProperty('--safe-top','${insets.top}px');s.setProperty('--safe-bottom','${insets.bottom}px');})();true;`;

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{ uri: EDITOR_URL }}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
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
