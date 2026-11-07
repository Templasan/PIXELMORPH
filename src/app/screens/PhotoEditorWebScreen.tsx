import { deleteWatermark, listWatermarks, saveWatermark } from './photo-editor/watermarks';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@core/i18n';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
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
import { createMediaAsset, createMediaMetadata } from '@modules/projects';
import { useAppModules } from '../hooks';
import { useEditorRecovery } from './useEditorRecovery';
import { parseQualitySetting, usePreviewQuality } from './usePreviewQuality';
import { createFileHost } from './video-editor/web-engine/fileHost';
import { loadFullImage } from './photo-editor/photoProxySkia';
import {
  encodeHeic,
  heicSupported,
  segmentSubject,
  labelImage,
  detectFaces,
} from '../../../modules/pixelmorph-video-export/src';
import { lightCopyOf } from './photo-editor/lightCopy';
import { PREVIEW_LONG_EDGE } from './photo-editor/resolution';
import { presetStep } from './photo-editor/batchPreset';
import { dateFormatter } from './projects/projectFormat';

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
  canHeic?: boolean;
  layers?: EditorLayer[];
  doubleExposure?: PictureRef | null;
  overlay?: PictureRef | null;
  bakes?: Record<string, number>[];
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
  const start = route.params?.start ?? '';
  const { projects } = useAppModules();
  const insets = useSafeAreaInsets();
  const { language } = useI18n();
  const webRef = useRef<WebView>(null);
  const { editorKey, onRenderProcessGone, reopen } = useEditorRecovery(navigation.goBack);
  // The preview quality the person picked; the page is not drawn until it is read.
  const { quality, setQuality } = usePreviewQuality();
  const files = useMemo(createFileHost, []);
  const historyRepo = useMemo(() => new LocalHistoryRepository(), []);
  // The asset a bake replaces the photo of (set when the project loads).
  const assetRef = useRef<{ id: string; format: string } | null>(null);
  // The light copy's long edge the page asked for (the quality's); a bake makes its copy the same.
  const previewEdgeRef = useRef(PREVIEW_LONG_EDGE);
  // The running export is a HEIC one (its quality) or not (null).
  const heicRef = useRef<number | null>(null);

  useEffect(() => () => files.close(), [files]);

  const handlers = useMemo<Record<string, (...args: never[]) => Promise<unknown>>>(
    () => ({
      async loadProject(previewEdge: number): Promise<SavedPhoto | null> {
        previewEdgeRef.current = previewEdge;
        const project = projectId ? await projects.getProject.execute(projectId) : null;
        const asset = project?.assets[0];
        if (!project || !asset) return null;
        const uri = asset.workingUri || asset.originalUri;
        const mime = asset.metadata.mimeType;
        assetRef.current = {
          id: asset.id,
          format: rawFormatLabel(mime) ?? (mime.split('/')[1] ?? '').toUpperCase(),
        };
        // The screen opens a small upright copy (made once); the export reads the original.
        const light = await lightCopyOf(uri, previewEdge);
        // The file's own size: the asset's metadata keeps the first file's after a bake.
        const file = await FileSystem.getInfoAsync(uri);
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
            format: assetRef.current.format,
            sizeBytes: file.exists ? file.size : asset.metadata.fileSizeBytes,
            width: light.width,
            height: light.height,
          },
          previewUri: light.uri,
          canHeic: heicSupported(),
          layers: layers ?? undefined,
          doubleExposure: images?.doubleExposure ?? null,
          overlay: images?.overlay ?? null,
          bakes: images?.bakes,
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
            bakes: saved.bakes,
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

      async lightCopy(uri: string, edge: number): Promise<string> {
        return (await lightCopyOf(uri, edge)).uri;
      },

      // US-02 batch edit: the other photo projects, and a look applied to some of them as one
      // undo step each (their editor shows it on open and can undo it).
      async listPhotoProjects() {
        const all = await projects.listProjects.execute({ type: 'photo' });
        // The date tells apart projects with the same name (two "Colagem", say).
        return all
          .filter((p) => p.id !== projectId)
          .map((p) => ({ id: p.id, name: `${p.name} · ${dateFormatter.format(p.updatedAt)}` }));
      },
      async applyLookTo(ids: string[], look: Record<string, number>) {
        for (const id of ids) {
          const snapshot = await historyRepo.load(id).catch(() => null);
          const past = snapshot?.past ?? [];
          await historyRepo.save(id, { past: [...past, presetStep(past, look)], future: [] });
        }
        return ids.length;
      },

      /** RF-004: the file stays in the project's folder, so it goes when the project goes. */
      async segmentSubject(uri: string): Promise<PictureRef> {
        const cut = await segmentSubject(
          uri,
          `${FileSystem.documentDirectory}media/${projectId}/cutout_${Date.now()}.png`.replace(
            /^file:\/\//,
            ''
          )
        );
        return { name: 'Recorte', uri: cut.uri };
      },

      labelImage: (uri: string) => labelImage(uri),
      detectFaces: (uri: string) => detectFaces(uri),

      listWatermarks,
      saveWatermark,
      deleteWatermark,

      async listPresets() {
        const presets = await createPhotoEditorModule().listPresets.execute();
        return presets.map(({ id, name, adjustments }) => ({ id, name, adjustments }));
      },
      async savePreset(name: string, adjustments: Record<string, number>) {
        await createPhotoEditorModule().savePreset.execute(name, adjustments);
      },

      // A collage or panorama made in the page becomes its own project, opened in a fresh editor
      // that replaces this one (pushing kept every earlier editor's WebView alive). Media first,
      // project last: a failed copy leaves no empty project behind.
      async newProjectStart() {
        await files.startExport('jpg');
      },
      async newProjectWrite(position: number, b64: string) {
        await files.writeExportChunk(position, b64);
      },
      async newProjectFinish(name: string, width: number, height: number) {
        const uri = await files.finishExport();
        const info = await FileSystem.getInfoAsync(uri);
        const project = await projects.createProjectWithMedia.execute(name, 'photo', [
          createMediaAsset(
            `asset_${Date.now()}`,
            'image',
            uri,
            uri,
            createMediaMetadata('image/jpeg', {
              width,
              height,
              fileSizeBytes: info.exists ? info.size : undefined,
            })
          ),
        ]);
        navigation.replace('PhotoEditor', { projectId: project.id });
        return project.id;
      },

      // HEIC: the page sends a quality-100 JPEG; the platform encoder makes the HEIC (as before).
      async exportStart(fileName: string, heicQuality: number | null) {
        heicRef.current = heicQuality;
        await files.startExport(
          heicQuality === null ? (fileName.split('.').pop() ?? 'jpg') : 'jpg'
        );
      },
      async exportWrite(position: number, b64: string) {
        await files.writeExportChunk(position, b64);
      },
      async exportFinish() {
        let uri = await files.finishExport();
        const heicQuality = heicRef.current;
        if (heicQuality !== null) {
          const jpeg = uri;
          uri = jpeg.replace(/\.jpg$/, '.heic');
          try {
            await encodeHeic(jpeg, uri, heicQuality);
          } finally {
            await FileSystem.deleteAsync(jpeg, { idempotent: true });
          }
        }
        // The gallery only takes pictures and videos: a Photoshop file goes where the person sends it.
        if (uri.endsWith('.psd')) {
          await Sharing.shareAsync(uri, { mimeType: 'image/vnd.adobe.photoshop' });
          return 'Arquivo PSD pronto.';
        }
        const permission = await MediaLibrary.requestPermissionsAsync(true); // write only: saving needs no read access
        if (!permission.granted) return 'Pronto, mas sem permissão para salvar na galeria.';
        await MediaLibrary.createAssetAsync(uri);
        return 'Salvo na galeria.';
      },

      async close() {
        navigation.navigate('Projects');
      },

      /** The page saved its project; the editor reopens at the quality picked (a new WebView). */
      async setPreviewQuality(setting: string) {
        await setQuality(parseQualitySetting(setting));
        reopen();
      },
    }),
    [files, historyRepo, navigation, projectId, projects, setQuality, reopen]
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

  // The saved preview quality is read asynchronously: the page must not start before it is known.
  if (quality === null) return <View style={styles.container} />;

  // The page draws edge to edge: give it the system bars' sizes before it lays out.
  // The editor's UI language (RNF-016), read once by the page before it draws.
  // The preview quality (a fixed word, read once by the page; see photo-editor-web/domain/previewQuality).
  const insetsScript = `(function(){window.__pmLanguage='${language}';window.__pmStart='${start}';window.__pmQuality='${quality}';var s=document.documentElement.style;s.setProperty('--safe-top','${insets.top}px');s.setProperty('--safe-bottom','${insets.bottom}px');})();true;`;

  return (
    <View style={styles.container}>
      <WebView
        key={editorKey}
        ref={webRef}
        onRenderProcessGone={onRenderProcessGone}
        source={{ uri: `${EDITOR_URL}#q=${quality}` }}
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
