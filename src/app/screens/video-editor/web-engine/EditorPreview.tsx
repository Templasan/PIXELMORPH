'use dom';

import { useEffect, useRef } from 'react';
import type { DOMProps } from 'expo/dom';
import type { WebScene } from '../../../../modules/video-editor/domain/webScene';
import { Engine, type FileMode } from './engine';
import { NEEDS_WEBVIEW } from '../previewTier';

/**
 * The video editor's preview (a DOM component = a WebView). Props go in, events come out through
 * function props. The engine owns the playback clock and reports time to the RN host.
 */
export interface EditorPreviewProps {
  dom?: DOMProps;
  /** null until the host knows the tier (it needs this component's `env` event first). */
  scene: WebScene | null;
  playing: boolean;
  /** A seek request; `id` makes a repeated request for the same time a new one. */
  seek: { id: number; ms: number };
  loop: { startMs: number; endMs: number } | null;
  maxLiveLayers: number;
  fileMode: FileMode;
  streamAboveBytes: number;
  readChunk(uri: string, offset: number, length: number): Promise<string>;
  getFileSize(uri: string): Promise<number>;
  onTime(ms: number): Promise<void>;
  onEvent(json: string): Promise<void>;
  onStatus(text: string): Promise<void>;
}

async function hardware1080(): Promise<boolean> {
  try {
    const r = await VideoDecoder.isConfigSupported({
      codec: 'avc1.640028',
      codedWidth: 1920,
      codedHeight: 1080,
      hardwareAcceleration: 'prefer-hardware',
    });
    return !!r.supported;
  } catch {
    return false;
  }
}

export default function EditorPreview(props: EditorPreviewProps) {
  const { scene, playing, seek, loop, maxLiveLayers, fileMode, streamAboveBytes } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  latest.current = props;

  const fail = (e: unknown) =>
    void latest.current.onEvent(
      JSON.stringify({ type: 'error', message: String((e as Error)?.message ?? e) })
    );

  // Environment report: the host needs it to pick the tier before it builds the scene.
  useEffect(() => {
    document.body.style.cssText =
      'margin:0;background:#000;overflow:hidden;height:100vh;display:flex;align-items:center';
    if (typeof VideoDecoder === 'undefined' || typeof VideoEncoder === 'undefined') {
      void latest.current.onStatus(NEEDS_WEBVIEW);
      return;
    }
    void hardware1080().then((hw) =>
      latest.current.onEvent(
        JSON.stringify({
          type: 'env',
          deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
          hardware1080: hw,
          userAgent: navigator.userAgent,
        })
      )
    );
  }, []);

  // Scene: the engine is created for the first one; later ones redraw the current frame.
  useEffect(() => {
    if (!scene || !canvasRef.current || typeof VideoDecoder === 'undefined') return;
    const existing = engineRef.current;
    if (existing) {
      void existing.setScene(scene).catch(fail);
      return;
    }
    const engine = new Engine(
      canvasRef.current,
      {
        readChunk: (...a) => latest.current.readChunk(...a),
        getFileSize: (...a) => latest.current.getFileSize(...a),
        startExport: async () => {},
        writeExportChunk: async () => {},
        finishExport: async () => '',
        onMetrics: async () => {},
        onStatus: (t) => latest.current.onStatus(t),
        onTime: (ms) => latest.current.onTime(ms),
        onEvent: (j) => latest.current.onEvent(j),
      },
      () => {},
      scene
    );
    engine.fileMode = fileMode;
    engine.streamAboveBytes = streamAboveBytes;
    engine.maxLive = maxLiveLayers;
    engine.loop = loop;
    engineRef.current = engine;
    engine
      .prepare(false)
      .then(async () => {
        await engine.seek(latest.current.seek.ms);
        ready.current = true;
        await latest.current.onEvent(JSON.stringify({ type: 'ready' }));
        if (latest.current.playing) await engine.playLive();
      })
      .catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(
    () => () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    []
  );

  useEffect(() => {
    const e = engineRef.current;
    if (e) {
      e.maxLive = maxLiveLayers;
      e.loop = loop;
    }
  }, [maxLiveLayers, loop]);

  // Declared before the play effect: a scrub followed by Play in one commit lands in order.
  useEffect(() => {
    if (ready.current) void engineRef.current?.seek(seek.ms).catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seek]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e || !ready.current) return;
    (playing ? e.playLive() : e.pause()).catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const w = scene?.width ?? 1920;
  const h = scene?.height ?? 1080;
  return (
    <canvas
      ref={canvasRef}
      width={w}
      height={h}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
  );
}
