'use dom';

import { useEffect, useRef, useState } from 'react';
import type { DOMProps } from 'expo/dom';
import type { WebScene } from '../../../../modules/video-editor/domain/webScene';
import { Engine, type FileMode, type Host } from './engine';

export interface EngineCommand {
  id: number;
  type: 'play' | 'pause' | 'seek' | 'seekBench' | 'export';
  ms?: number;
}

interface Props extends Host {
  dom?: DOMProps;
  scene: WebScene;
  command: EngineCommand;
  fileMode: FileMode;
  appState: string;
}

const NEEDS_WEBVIEW = 'O motor de vídeo precisa do Android System WebView atualizado';

async function envReport(fileMode: FileMode) {
  const hasDecoder = typeof VideoDecoder !== 'undefined';
  let avc: unknown = null;
  if (hasDecoder) {
    try {
      avc = await VideoDecoder.isConfigSupported({
        codec: 'avc1.640028',
        codedWidth: 1920,
        codedHeight: 1080,
        hardwareAcceleration: 'prefer-hardware',
      });
    } catch (e) {
      avc = String(e);
    }
  }
  const probe = document.createElement('canvas');
  return {
    userAgent: navigator.userAgent,
    webcodecs: hasDecoder && typeof VideoEncoder !== 'undefined',
    avc1_640028_1080p_preferHardware: avc,
    webgl2: !!probe.getContext('webgl2'),
    webgpu: 'gpu' in navigator,
    fileModeRequested: fileMode,
    location: location.href,
  };
}

export default function WebEngine(props: Props) {
  const { scene, command, fileMode, appState } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const hostRef = useRef<Host>(props);
  hostRef.current = props;
  const [error, setError] = useState<string | null>(null);
  const supported = typeof VideoDecoder !== 'undefined';
  const sceneKey = JSON.stringify(scene.main.durationMs) + scene.pips.map((p) => p.uri).join();

  // Created once per scene; Host methods are looked up lazily so prop re-emits do not matter.
  useEffect(() => {
    document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
    if (!supported || !canvasRef.current) {
      void envReport(fileMode).then((env) =>
        hostRef.current.onMetrics(JSON.stringify({ section: 'env', data: env }))
      );
      void hostRef.current.onStatus(NEEDS_WEBVIEW);
      return;
    }
    const host: Host = {
      readChunk: (...a) => hostRef.current.readChunk(...a),
      getFileSize: (...a) => hostRef.current.getFileSize(...a),
      startExport: () => hostRef.current.startExport(),
      writeExportChunk: (...a) => hostRef.current.writeExportChunk(...a),
      finishExport: () => hostRef.current.finishExport(),
      onMetrics: (j) => hostRef.current.onMetrics(j),
      onStatus: (t) => hostRef.current.onStatus(t),
    };
    const engine = new Engine(
      canvasRef.current,
      host,
      (t) => {
        if (hudRef.current) hudRef.current.textContent = t;
      },
      scene
    );
    engine.fileMode = fileMode;
    engineRef.current = engine;
    (async () => {
      const env = await envReport(fileMode);
      await host.onMetrics(JSON.stringify({ section: 'env', data: env }));
      await engine.prepare();
      await host.onMetrics(
        JSON.stringify({ section: 'fileAccess', data: engine.fileAccessReport() })
      );
      await host.onStatus('pronto');
    })().catch((e) => {
      setError(String(e?.stack ?? e));
      void host.onStatus(`erro: ${String(e?.message ?? e)}`);
    });
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, fileMode]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.appState = appState;
  }, [appState]);

  const lastCommand = useRef(0);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || command.id === lastCommand.current) return;
    lastCommand.current = command.id;
    const run = async () => {
      if (command.type === 'play') await engine.play();
      else if (command.type === 'pause') await engine.pause();
      else if (command.type === 'seek') await engine.seekTo(command.ms ?? 0);
      else if (command.type === 'seekBench') await engine.seekBench(20);
      else if (command.type === 'export') await engine.exportMp4();
    };
    run().catch((e) => {
      setError(String(e?.stack ?? e));
      void hostRef.current.onStatus(`erro: ${String(e?.message ?? e)}`);
    });
  }, [command]);

  if (!supported) {
    return (
      <div style={{ color: '#fff', font: '16px sans-serif', padding: 16, background: '#300' }}>
        {NEEDS_WEBVIEW}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: '100%', background: '#000' }}>
      <canvas
        ref={canvasRef}
        width={scene.width}
        height={scene.height}
        style={{ width: '100%', display: 'block' }}
      />
      <div
        ref={hudRef}
        style={{
          position: 'absolute',
          top: 4,
          left: 6,
          color: '#0f0',
          font: '12px monospace',
          textShadow: '0 0 3px #000',
        }}
      />
      {error ? (
        <div style={{ color: '#f66', font: '11px monospace', padding: 4, whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
