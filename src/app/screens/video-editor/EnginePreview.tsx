import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { createStore, shallowEqual, useStore } from '@core/state';
import type { Track } from '@modules/video-editor';
import { buildEditorScene } from '../../../modules/video-editor/domain/webScene';
import EditorPreview from './web-engine/EditorPreview';
import { createFileHost, STREAM_ABOVE_BYTES } from './web-engine/fileHost';
import { patchPreviewSession, previewSession, previewSettings } from './previewSettings';
import { proxyStore, requestSourceProxy } from './previewProxy';
import {
  autoTier,
  NEEDS_WEBVIEW,
  previewUriFor,
  resolveTier,
  TIER_SPECS,
  type Tier,
} from './previewTier';
import type { TimeStore } from './timeStore';
import {
  engineExport,
  reportEngineExportProgress,
  settleEngineExport,
  type EngineExportResult,
} from './engineExport';

/** No sign of life from the web side in this long: the System WebView is too old to run it. */
const NO_STATUS_MS = 10_000;

/** The tier actually in use, for the quality menu and badge. */
export const tierInUse = createStore<Tier | null>(null);

interface Props {
  tracks: Track[];
  timeStore: TimeStore;
  playing: boolean;
  loopRange: { startMs: number; endMs: number } | null;
  /** Stop the transport: the engine reached the end, or the app went to the background. */
  onEnded: () => void;
  /** Maximum long edge (width or height) of any video source in the project, for auto-tier logic. */
  maxSourceLongEdge?: number;
}

/**
 * The web engine as the editor's preview. The engine owns the clock while playing and reports
 * time into `timeStore`; a timeStore change that did not come from the engine is a user seek.
 */
export function EnginePreview({
  tracks,
  timeStore,
  playing,
  loopRange,
  onEnded,
  maxSourceLongEdge,
}: Props) {
  const settings = useStore(previewSettings);
  const session = useStore(previewSession);
  const [ready, setReady] = useState(false);
  const [seek, setSeek] = useState(() => ({ id: 0, ms: timeStore.get() }));
  const lastReported = useRef(timeStore.get());
  const files = useMemo(createFileHost, []);
  const gotSign = useRef(false);
  const readyRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const tier = resolveTier(
    settings.quality,
    session.env ? autoTier(session.env, maxSourceLongEdge ?? 0) : 'media',
    session.steppedDown
  );
  useEffect(() => {
    tierInUse.set(session.env ? tier : null);
    return () => tierInUse.set(null);
  }, [tier, session.env]);

  const videoUris = useMemo(
    () => [
      ...new Set(
        tracks.flatMap((t) => (t.kind === 'video' ? t.clips.map((c) => c.sourceUri) : []))
      ),
    ],
    [tracks]
  );
  // Baixa needs the 540p proxies and Alta the 1080p ones (made only now); until they exist the
  // preview decodes the 720p ones.
  useEffect(() => {
    if (tier === 'alta' || tier === 'baixa') {
      for (const uri of videoUris) void requestSourceProxy(uri, tier === 'alta' ? '1080' : '540');
    }
  }, [tier, videoUris]);
  const mapping = useStore(
    proxyStore,
    (state) => Object.fromEntries(videoUris.map((u) => [u, previewUriFor(tier, state, u)])),
    shallowEqual
  );

  useEffect(() => {
    if (session.env) console.log('[editor-engine] tier', tier, JSON.stringify(mapping));
  }, [tier, mapping, session.env]);

  const scene = useMemo(
    () =>
      session.env
        ? buildEditorScene(tracks, {
            ...TIER_SPECS[tier].canvas,
            mapUri: (u) => mapping[u] ?? u,
          })
        : null,
    [tracks, tier, mapping, session.env]
  );

  // The export reads the originals (no proxy) at the preset's size, cropped to fill like the
  // native exporter.
  const exportRequest = useStore(engineExport, (s) => s.request);
  const cancelExportId = useStore(engineExport, (s) => s.cancelId);
  const exportJob = useMemo(
    () =>
      exportRequest
        ? {
            id: exportRequest.id,
            bitrate: exportRequest.bitrate,
            gif: exportRequest.gif,
            scene: buildEditorScene(tracks, {
              width: exportRequest.width,
              height: exportRequest.height,
              fit: 'cover',
            }),
          }
        : null,
    // The timeline cannot change under the open export sheet; the request alone decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exportRequest]
  );
  const onExportProgress = useCallback(async (id: number, pct: number) => {
    reportEngineExportProgress(id, pct);
  }, []);
  const onExportDone = useCallback(
    async (id: number, json: string) => {
      const out = JSON.parse(json) as {
        path?: string;
        bytes?: number;
        durationMs?: number;
        frameCount?: number;
        truncated?: boolean;
        error?: string;
      };
      if (out.error || !out.path) {
        files.abortExport();
        settleEngineExport(id, { error: out.error ?? 'Não foi possível exportar o vídeo.' });
        return;
      }
      const result: EngineExportResult = {
        uri: out.path,
        sizeBytes: out.bytes ?? 0,
        durationMs: out.durationMs ?? 0,
        frameCount: out.frameCount,
        truncated: out.truncated,
      };
      settleEngineExport(id, { result });
    },
    [files]
  );
  // Leaving web mode (fallback) or the editor with an export running: it cannot finish.
  useEffect(
    () => () => {
      const req = engineExport.get().request;
      if (req) settleEngineExport(req.id, { error: 'O motor de vídeo foi fechado.' });
    },
    []
  );

  // A timeStore value the engine did not report is the user scrubbing (ruler, frame step, jump).
  useEffect(
    () =>
      timeStore.subscribe(() => {
        const ms = timeStore.get();
        if (ms === lastReported.current) return;
        lastReported.current = ms;
        setSeek((s) => ({ id: s.id + 1, ms }));
      }),
    [timeStore]
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') onEndedRef.current(); // a hidden WebView freezes; stop the transport
    });
    return () => sub.remove();
  }, []);

  const fallBack = useCallback((reason: 'webview' | 'error') => {
    if (!previewSession.get().fallback) patchPreviewSession({ fallback: reason });
  }, []);

  // The bundle of an old WebView dies before our code runs and can never say so itself.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!gotSign.current) fallBack('webview');
    }, NO_STATUS_MS);
    return () => clearTimeout(t);
  }, [fallBack]);
  useEffect(() => () => files.close(), [files]);

  const onTime = useCallback(
    async (ms: number) => {
      lastReported.current = ms;
      timeStore.set(ms);
    },
    [timeStore]
  );
  const onStatus = useCallback(
    async (text: string) => {
      gotSign.current = true;
      if (text.startsWith(NEEDS_WEBVIEW)) fallBack('webview');
    },
    [fallBack]
  );
  const onEvent = useCallback(
    async (json: string) => {
      gotSign.current = true;
      const e = JSON.parse(json) as {
        type: string;
        deviceMemoryGb?: number;
        hardware1080?: boolean;
        message?: string;
      };
      if (e.type === 'env') {
        patchPreviewSession({
          env: { deviceMemoryGb: e.deviceMemoryGb, hardware1080: !!e.hardware1080 },
        });
      } else if (e.type === 'probe') {
        console.log('[editor-engine] probe', json);
      } else if (e.type === 'ready') {
        readyRef.current = true;
        setReady(true);
      } else if (e.type === 'ended') {
        onEndedRef.current();
      } else if (e.type === 'error') {
        console.log('[editor-engine] error', e.message);
        if (!readyRef.current) fallBack('error');
      } else if (e.type === 'drops') {
        const s = previewSession.get();
        // Only Automática steps down by itself, once per session; a manual tier is the user's call.
        if (
          previewSettings.get().quality === 'auto' &&
          !s.steppedDown &&
          s.env &&
          resolveTier('auto', autoTier(s.env), false) !== 'baixa'
        ) {
          patchPreviewSession({
            steppedDown: true,
            notice: 'Prévia reduzida para manter a fluidez',
          });
          setTimeout(() => patchPreviewSession({ notice: null }), 4000);
        }
      }
    },
    [fallBack]
  );

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
      }}
    >
      <EditorPreview
        dom={{
          style: { width: '100%', height: '100%' },
          webviewDebuggingEnabled: __DEV__,
          // Play is commanded from RN, never a tap inside the page: let the engine's audio start.
          mediaPlaybackRequiresUserAction: false,
        }}
        scene={scene}
        playing={playing && ready}
        seek={seek}
        loop={loopRange}
        maxLiveLayers={TIER_SPECS[tier].maxLiveLayers}
        fileMode="auto"
        streamAboveBytes={STREAM_ABOVE_BYTES}
        readChunk={files.readChunk}
        getFileSize={files.getFileSize}
        onTime={onTime}
        onEvent={onEvent}
        onStatus={onStatus}
        exportJob={exportJob}
        cancelExportId={cancelExportId}
        startExport={files.startExport}
        writeExportChunk={files.writeExportChunk}
        finishExport={files.finishExport}
        onExportProgress={onExportProgress}
        onExportDone={onExportDone}
      />
    </View>
  );
}
