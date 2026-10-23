import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Icon } from '@core/ui';
import { cancelEngineExport, exportWithEngine } from './engineExport';
import { previewSession } from './previewSettings';
import { pauseProxiesForExport, resumeProxies } from './previewProxy';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { errorLogger } from '@core/reliability';
import { formatBytes } from '@core/reliability/storageUsage';
import {
  GIF_COLOR_OPTIONS,
  GIF_FPS_OPTIONS,
  GIF_WIDTH_OPTIONS,
  gifSize,
  VIDEO_PRESETS,
  originalPreset,
  planExport,
  type Track,
  type VideoPreset,
} from '@modules/video-editor';

interface VideoExportSheetProps {
  tracks: Track[];
  /** Size of the project's main video, used for the "Original" preset. */
  sourceWidth?: number;
  sourceHeight?: number;
  onClose: () => void;
}

type State =
  | { phase: 'idle' }
  | { phase: 'exporting'; progress: number }
  | {
      phase: 'done';
      uri: string;
      sizeBytes: number;
      summary: string;
      tookMs: number;
      note?: string;
    }
  | { phase: 'error'; message: string };

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * US-16/US-30: real video export — stitches the timeline (video and image tracks: trim, speed,
 * rotation, freeze frames, time-lapse photos, transitions) into one H.264/AAC mp4 (or GIF) using
 * the web engine (WebCodecs). The same `drawListAt` that drives the preview writes the file, so
 * preview and export cannot drift. See funcionalidades_faltantes/US-30.
 */
export function VideoExportSheet({
  tracks,
  sourceWidth,
  sourceHeight,
  onClose,
}: VideoExportSheetProps) {
  const insets = useSafeAreaInsets();
  const original = originalPreset(sourceWidth ?? 0, sourceHeight ?? 0);
  const presets: VideoPreset[] = [original, ...VIDEO_PRESETS];
  const [preset, setPreset] = useState<VideoPreset>(original);
  const [format, setFormat] = useState<'mp4' | 'gif'>('mp4');
  const [gifFps, setGifFps] = useState<number>(10);
  const [gifColors, setGifColors] = useState<number>(128);
  const [gifWidth, setGifWidth] = useState<number>(360);
  const cancelledRef = useRef(false);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const exportingRef = useRef(false);

  const plan = planExport(tracks);

  // Leaving the sheet mid-export stops the encoder instead of leaving it running unseen.
  useEffect(
    () => () => {
      if (exportingRef.current) {
        cancelledRef.current = true;
        cancelEngineExport();
      }
    },
    []
  );

  const startExport = useCallback(async () => {
    if (exportingRef.current) return;
    // The engine is the only exporter: when it could not start on this device nobody would
    // answer the request and the sheet would wait forever.
    if (previewSession.get().fallback) {
      setState({
        phase: 'error',
        message:
          'A exportação de vídeo precisa do Android System WebView atualizado. Atualize-o na Play Store e abra o projeto de novo.',
      });
      return;
    }
    if (plan.clips.length === 0 || plan.durationMs <= 0) {
      setState({
        phase: 'error',
        message: 'Não há nada para exportar: adicione vídeos ou fotos visíveis.',
      });
      return;
    }
    exportingRef.current = true;
    cancelledRef.current = false;
    setSaveState('idle');
    setState({ phase: 'exporting', progress: 0 });
    const startedAt = Date.now();
    // TODO: Android slows the WebView engine to ~1/3 when the app leaves the screen; keep the
    // screen on during export and say so (agent-briefing.md §6 item 16).
    // The hardware encoder is single-slot: the preview proxies stop before the export touches it.
    await pauseProxiesForExport();
    try {
      if (format === 'gif') {
        if (cancelledRef.current) throw new Error('CANCELLED');
        // Same frames as the preview (text, colour, pictures, transitions), at the GIF's size.
        const size = gifSize(sourceWidth ?? 0, sourceHeight ?? 0, gifWidth);
        const gif = await exportWithEngine(
          { ...size, bitrate: 0, gif: { fps: gifFps, maxColors: gifColors } },
          (progress) => setState({ phase: 'exporting', progress })
        );
        setState({
          phase: 'done',
          uri: gif.uri,
          sizeBytes: gif.sizeBytes,
          summary: `${size.width}×${size.height} · ${gif.frameCount ?? 0} quadros · GIF`,
          tookMs: Date.now() - startedAt,
          note: gif.truncated ? 'O GIF foi cortado em 15 s.' : undefined,
        });
        return;
      }
      // MP4 through the web engine (originals at preset size, same drawOps as preview).
      if (cancelledRef.current) throw new Error('CANCELLED');
      const result = await exportWithEngine(
        { width: preset.width, height: preset.height, bitrate: preset.bitrate },
        (progress) => setState({ phase: 'exporting', progress })
      );
      setState({
        phase: 'done',
        uri: result.uri,
        sizeBytes: result.sizeBytes,
        summary: `${preset.width}×${preset.height} · ${formatDuration(result.durationMs || plan.durationMs)} · MP4`,
        tookMs: Date.now() - startedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'CANCELLED') {
        setState({ phase: 'idle' });
        return;
      }
      errorLogger.log(error, 'VideoExportSheet.export');
      setState({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível exportar o vídeo.',
      });
    } finally {
      exportingRef.current = false;
      resumeProxies();
    }
  }, [plan, preset, format, gifFps, gifColors, gifWidth, sourceWidth, sourceHeight]);

  const saveToGallery = useCallback(async () => {
    if (state.phase !== 'done') return;
    setSaveState('saving');
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) throw new Error('PERMISSION_DENIED');
      await MediaLibrary.createAssetAsync(state.uri);
      setSaveState('saved');
    } catch (error) {
      if (!(error instanceof Error && error.message === 'PERMISSION_DENIED')) {
        errorLogger.log(error, 'VideoExportSheet.save');
      }
      setSaveState('error');
    }
  }, [state]);

  const exporting = state.phase === 'exporting';

  const chips = (
    options: readonly number[],
    value: number,
    onPick: (n: number) => void,
    label: (n: number) => string
  ) => (
    <View style={styles.formatRow}>
      {options.map((n) => (
        <Pressable
          key={n}
          style={[styles.formatChip, value === n && styles.rowActive]}
          onPress={() => onPick(n)}
          disabled={exporting}
        >
          <Text style={[styles.rowName, value === n && styles.rowNameActive]}>{label(n)}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.veil} onPress={exporting ? undefined : onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Exportar vídeo</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Fechar">
            <Icon name="x" size={20} />
          </Pressable>
        </View>

        {state.phase === 'done' ? (
          <View style={styles.centered}>
            <Icon name="check" size={28} color={colors.ok} />
            <Text style={styles.doneTitle}>Vídeo exportado</Text>
            <Text style={styles.meta}>
              {state.summary} · {formatBytes(state.sizeBytes)}
            </Text>
            {state.note && <Text style={styles.meta}>{state.note}</Text>}
            <Text style={styles.meta}>Gerado em {(state.tookMs / 1000).toFixed(1)} s</Text>
            <Pressable
              style={styles.primary}
              onPress={saveToGallery}
              disabled={saveState === 'saving' || saveState === 'saved'}
            >
              <Text style={styles.primaryText}>
                {saveState === 'saving'
                  ? 'SALVANDO…'
                  : saveState === 'saved'
                    ? 'SALVO NA GALERIA ✓'
                    : 'SALVAR NA GALERIA'}
              </Text>
            </Pressable>
            {saveState === 'error' && (
              <Text style={styles.error}>
                Não foi possível salvar. Autorize o acesso à galeria e tente de novo.
              </Text>
            )}
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.formatRow}>
              {(['mp4', 'gif'] as const).map((f) => (
                <Pressable
                  key={f}
                  style={[styles.formatChip, format === f && styles.rowActive]}
                  onPress={() => setFormat(f)}
                  disabled={exporting}
                >
                  <Text style={[styles.rowName, format === f && styles.rowNameActive]}>
                    {f === 'mp4' ? 'VÍDEO MP4' : 'GIF ANIMADO'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {format === 'gif' ? (
              <>
                <Text style={styles.section}>QUADROS POR SEGUNDO</Text>
                {chips(GIF_FPS_OPTIONS, gifFps, setGifFps, (n) => `${n} fps`)}
                <Text style={styles.section}>NÚMERO DE CORES</Text>
                {chips(GIF_COLOR_OPTIONS, gifColors, setGifColors, (n) => `${n}`)}
                <Text style={styles.section}>LARGURA</Text>
                {chips(GIF_WIDTH_OPTIONS, gifWidth, setGifWidth, (n) => `${n}px`)}
              </>
            ) : (
              <Text style={styles.section}>PRESET</Text>
            )}
            {format === 'mp4' &&
              presets.map((p) => {
                const active = p.name === preset.name;
                return (
                  <Pressable
                    key={p.name}
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => setPreset(p)}
                    disabled={exporting}
                  >
                    <Text style={[styles.rowName, active && styles.rowNameActive]}>{p.name}</Text>
                    <Text style={styles.rowMeta}>
                      {p.width}×{p.height} · {(p.bitrate / 1_000_000).toFixed(1)} Mbps
                    </Text>
                  </Pressable>
                );
              })}

            <Text style={styles.note}>
              {plan.clips.length === 0
                ? 'Não há vídeos ou fotos visíveis na linha do tempo para exportar.'
                : `${plan.clips.filter((c) => c.kind !== 'gap').length} clipe(s) · ${formatDuration(plan.durationMs)}${plan.transitions.length > 0 ? ` · ${plan.transitions.length} transição(ões)` : ''}. Vídeos e fotos das faixas visíveis entram em sequência (a faixa de cima vale onde se sobrepõem; espaços vazios viram tela preta). A faixa de áudio A1 é misturada ao som.`}
            </Text>

            {exporting && (
              <View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${state.progress}%` }]} />
                </View>
                <Text style={styles.meta}>{Math.round(state.progress)}%</Text>
              </View>
            )}
            {state.phase === 'error' && <Text style={styles.error}>{state.message}</Text>}

            {exporting ? (
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  cancelledRef.current = true;
                  cancelEngineExport();
                }}
              >
                <Text style={styles.secondaryText}>CANCELAR</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primary, plan.clips.length === 0 && styles.primaryDisabled]}
                onPress={startExport}
                disabled={plan.clips.length === 0}
              >
                <Text style={styles.primaryText}>EXPORTAR</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: { fontSize: fontSize.lg, fontWeight: '600', color: colors.texto },
  body: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  section: {
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.texto2,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  rowActive: { borderColor: colors.acento },
  formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formatChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  rowName: { fontSize: fontSize.sm, color: colors.texto },
  rowNameActive: { color: colors.acento },
  rowMeta: { fontSize: fontSize.xs, color: colors.texto2, fontFamily: monoFontFamily },
  note: { fontSize: fontSize.xs, color: colors.texto2, lineHeight: 18, paddingTop: 4 },
  track: { height: 6, backgroundColor: colors.linha, marginTop: 8 },
  fill: { height: 6, backgroundColor: colors.acento },
  meta: { fontSize: fontSize.xs, color: colors.texto2, fontFamily: monoFontFamily },
  error: { fontSize: fontSize.xs, color: colors.perigo, lineHeight: 18 },
  primary: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.acento,
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { fontSize: fontSize.sm, fontWeight: '700', color: '#0D2036', letterSpacing: 1 },
  secondary: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.linha,
  },
  secondaryText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.texto,
    letterSpacing: 1,
  },
  centered: { alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingBottom: 16 },
  doneTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.texto },
});
