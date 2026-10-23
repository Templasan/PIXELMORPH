import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SkImage } from '@shopify/react-native-skia';
import {
  IMAGE_FORMATS,
  SIZE_PRESETS,
  SOCIAL_PRESETS,
  formatBytes,
  applyDpi,
  drawWatermark,
  encodeImage,
  encodeToTargetSize,
  resizeImageCover,
  resizeImageToFit,
  watermarkFontSize,
  watermarkShadow,
  type EncodedImage,
  type ImageExportFormat,
} from '@modules/export';
import { saveImageToGallery } from '@modules/device-media';
import { encodeHeicImage, heicSupported } from './heicExport';
import { errorLogger } from '@core/reliability';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { Icon, Slider, Switch, Tabs } from '@core/ui';

interface ExportSheetProps {
  onClose: () => void;
  /** The user's last choices; kept by the screen so they survive closing the sheet. */
  options: ExportOptions;
  onOptionsChange: (options: ExportOptions) => void;
  /** Which pipeline this sheet is exporting from — video has no real encoder in this build. */
  mediaKind?: 'photo' | 'video';
  /** RF-057: the current edit as a Skia image at full resolution, e.g. an offscreen re-render; may resolve null. */
  getSourceImage?: () => SkImage | null | Promise<SkImage | null>;
  /** Called once encoding succeeds, so the caller can mark its project as no longer a draft. */
  onExported?: (result: EncodedImage) => void;
}

type ExportTab = 'RÁPIDO' | "MARCA D'ÁGUA";
const EXPORT_TABS: readonly ExportTab[] = ['RÁPIDO', "MARCA D'ÁGUA"];

type ExportState = 'idle' | 'exporting' | 'done' | 'error';

const DPI_OPTIONS = ['72', '150', '300', '600'];
const WATERMARK_POSITIONS = ['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'];
const GRID_ALIGN = ['flex-start', 'center', 'flex-end'] as const;
const WATERMARK_COLOR = '#FFFFFF';
/** RF-057: the platform HEIC encoder exists only on Android 9+. */
const HEIC_AVAILABLE = heicSupported();

/** Every choice the user makes in the sheet (transient results and errors are not in here). */
export interface ExportOptions {
  tab: ExportTab;
  format: ImageExportFormat;
  quality: number;
  sizeChip: string;
  socialPreset: string | null;
  smartCompression: boolean;
  targetSizeMB: number;
  dpi: string;
  wmText: string;
  wmPosition: number;
  opacity: number;
  wmSize: number;
  wmRotation: number;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  tab: 'RÁPIDO',
  format: 'JPEG',
  quality: 85,
  sizeChip: 'Original',
  socialPreset: null,
  smartCompression: false,
  targetSizeMB: 2,
  dpi: '300',
  wmText: '',
  wmPosition: 8,
  opacity: 60,
  wmSize: 20,
  wmRotation: 0,
};

/**
 * Modal export sheet — covers ~88% of the height over the current editor. Rendered as an
 * overlay by PhotoEditorScreen / VideoEditorScreen; not a route.
 *
 * RF-057: photo export is genuinely real — it encodes the editor's actual Skia canvas
 * snapshot to JPEG/PNG/WebP bytes via Skia's own encoder. RNF-013's "smart compression" is
 * a real binary search against the encoder's own output size. Watermark text and DPI are
 * written into the file. Video export, PSD/TIFF, GIF and HEIC need an encoder this build
 * doesn't have (FFmpeg-class / native image codecs), and are not offered.
 */
export function ExportSheet({
  onClose,
  options,
  onOptionsChange,
  mediaKind = 'photo',
  getSourceImage,
  onExported,
}: ExportSheetProps) {
  const insets = useSafeAreaInsets();
  // Works on its own copy and hands every change back, so the screen keeps the latest choices.
  const [opts, setOpts] = useState<ExportOptions>(options);
  useEffect(() => {
    onOptionsChange(opts);
  }, [opts, onOptionsChange]);
  const {
    tab,
    format,
    quality,
    sizeChip,
    socialPreset,
    smartCompression,
    targetSizeMB,
    dpi,
    wmText,
    wmPosition,
    opacity,
    wmSize,
    wmRotation,
  } = opts;
  const setOpt =
    <K extends keyof ExportOptions>(key: K) =>
    (value: ExportOptions[K]) =>
      setOpts((prev) => ({ ...prev, [key]: value }));
  const setTab = setOpt('tab');
  const setFormat = setOpt('format');
  const setQuality = setOpt('quality');
  const setSizeChip = setOpt('sizeChip');
  const setSocialPreset = setOpt('socialPreset');
  const setSmartCompression = setOpt('smartCompression');
  const setTargetSizeMB = setOpt('targetSizeMB');
  const setDpi = setOpt('dpi');
  const setWmText = setOpt('wmText');
  const setWmPosition = setOpt('wmPosition');
  const setOpacity = setOpt('opacity');
  const setWmSize = setOpt('wmSize');
  const setWmRotation = setOpt('wmRotation');
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<EncodedImage | null>(null);
  // HEIC results show the JPEG they were made from (HEIC does not display everywhere).
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState(300);
  const previewFontSize = watermarkFontSize(previewWidth, wmSize);
  const previewShadow = watermarkShadow(previewFontSize);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState('');

  // RF-057 "Salvar": a real file, written via expo-file-system and added to the device's
  // own photo library via expo-media-library — no longer a fake "not installed" notice.
  const handleSave = useCallback(async () => {
    if (!result) return;
    setSaveState('saving');
    try {
      await saveImageToGallery(result.base64, result.format);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      if (error instanceof Error && error.message === 'PERMISSION_DENIED') {
        setSaveErrorMessage('Autorize o acesso à galeria para salvar a exportação.');
      } else {
        setSaveErrorMessage('Não foi possível salvar na galeria.');
        errorLogger.log(error, 'ExportSheet.handleSave');
      }
    }
  }, [result]);

  const handleExport = useCallback(async () => {
    if (mediaKind !== 'photo' || !getSourceImage) {
      setExportState('error');
      setErrorMessage(
        'Exportação de vídeo exige um codificador nativo (ex.: FFmpeg), não incluído neste build.'
      );
      return;
    }
    setExportState('exporting');
    setSaveState('idle');
    // Rendering the full-resolution edit can take a moment, so the spinner is already up.
    // A failed render lands in the same "could not capture" error as a null one.
    const source = await Promise.resolve()
      .then(getSourceImage)
      .catch(() => null);
    if (!source) {
      setExportState('error');
      setErrorMessage('Não foi possível capturar a imagem atual do editor.');
      return;
    }
    // Let "Processando..." paint before the (synchronous) encode work runs.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const sized = socialPreset
        ? resizeImageCover(
            source,
            SOCIAL_PRESETS.find((p) => p.name === socialPreset)!.width,
            SOCIAL_PRESETS.find((p) => p.name === socialPreset)!.height
          )
        : resizeImageToFit(
            source,
            (SIZE_PRESETS.find((p) => p.name === sizeChip) ?? SIZE_PRESETS[0]).maxLongEdge
          );
      const image = wmText.trim()
        ? drawWatermark(sized, {
            text: wmText.trim(),
            color: WATERMARK_COLOR,
            opacity: opacity / 100,
            position: wmPosition,
            size: wmSize,
            rotation: wmRotation,
          })
        : sized;

      if (format === 'HEIC') {
        // Target size is not offered for HEIC: each probe would be a native re-encode.
        const { heic, preview } = await encodeHeicImage(image, quality);
        setResult(heic);
        setPreviewBase64(preview.base64);
        setExportState('done');
        onExported?.(preview);
        return;
      }
      const raw = smartCompression
        ? encodeToTargetSize(image, format, Math.round(targetSizeMB * 1024 * 1024))
        : encodeImage(image, format, quality);
      const encoded = applyDpi(raw, Number(dpi));

      setResult(encoded);
      setPreviewBase64(null);
      setExportState('done');
      onExported?.(encoded);
    } catch (error) {
      setExportState('error');
      setErrorMessage('Falha ao codificar a imagem.');
      errorLogger.log(error, 'ExportSheet.handleExport');
    }
  }, [
    mediaKind,
    getSourceImage,
    socialPreset,
    sizeChip,
    smartCompression,
    targetSizeMB,
    format,
    quality,
    dpi,
    wmText,
    wmPosition,
    wmSize,
    wmRotation,
    opacity,
    onExported,
  ]);

  return (
    <View style={styles.overlay}>
      {/* Same absolute-overlay-ignores-parent-padding issue as SideDrawer: re-apply the
          bottom inset so the sheet's footer isn't obscured by a gesture nav bar. */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Exportar</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="x" size={20} />
          </Pressable>
        </View>

        {mediaKind === 'video' ? (
          <View style={styles.centeredContent}>
            <Icon name="film" size={28} color={colors.linha} />
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.doneTitle}>Exportação de vídeo indisponível</Text>
              <Text style={[styles.warningText, styles.warningTextBlock, { color: colors.texto2 }]}>
                Unir clipes, aplicar transições e recodificar um vídeo final exige um codificador
                nativo (classe FFmpeg) que não está incluído neste build Expo gerenciado. A linha do
                tempo e todas as edições continuam reais e são salvas — só a etapa final de gravação
                do arquivo de vídeo não está disponível aqui.
              </Text>
            </View>
            <Pressable style={styles.exportButton} onPress={onClose}>
              <Text style={styles.exportButtonText}>Entendi</Text>
            </Pressable>
          </View>
        ) : exportState === 'done' && result ? (
          <View style={styles.centeredContent}>
            <View>
              <Image
                source={{
                  uri: previewBase64
                    ? `data:image/jpeg;base64,${previewBase64}`
                    : `data:image/${result.format.toLowerCase()};base64,${result.base64}`,
                }}
                style={styles.doneThumb}
                resizeMode="cover"
              />
              <View style={styles.doneCheck}>
                <Icon name="check" size={16} color={colors.preto} />
              </View>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.doneTitle}>Exportação concluída</Text>
              <Text style={styles.doneMeta}>
                {result.format} · {result.width}×{result.height} ·{' '}
                {formatBytes(result.bytes.length)}
                {smartCompression ? ` · qualidade ${result.quality}%` : ''}
              </Text>
            </View>
            {saveState === 'saved' ? (
              <View style={styles.savedRow}>
                <Icon name="check" size={14} color={colors.ok} />
                <Text style={[styles.warningText, styles.savedText]}>
                  Salva na galeria do dispositivo.
                </Text>
              </View>
            ) : (
              <Pressable
                style={[styles.saveButton, saveState === 'saving' && styles.chipDisabled]}
                onPress={handleSave}
                disabled={saveState === 'saving'}
              >
                {saveState === 'saving' ? (
                  <ActivityIndicator size="small" color={colors.texto} />
                ) : (
                  <Icon name="save" size={14} color={colors.texto} />
                )}
                <Text style={styles.saveButtonText}>Salvar na galeria</Text>
              </Pressable>
            )}
            {saveState === 'error' && (
              <Text style={[styles.warningText, styles.warningTextBlock]}>{saveErrorMessage}</Text>
            )}
            <Text style={[styles.warningText, styles.warningTextBlock, { color: colors.texto2 }]}>
              Compartilhar diretamente por outros apps ainda exige o módulo de compartilhamento do
              Expo, não instalado neste build.
            </Text>
            <Pressable style={styles.exportButton} onPress={onClose}>
              <Text style={styles.exportButtonText}>Concluído</Text>
            </Pressable>
          </View>
        ) : exportState === 'exporting' ? (
          <View style={styles.centeredContent}>
            <Text style={styles.processingText}>Processando...</Text>
          </View>
        ) : exportState === 'error' ? (
          <View style={styles.centeredContent}>
            <Icon name="triangle" size={24} color={colors.alerta} />
            <Text style={[styles.warningText, styles.warningTextBlock]}>{errorMessage}</Text>
            <Pressable style={styles.exportButton} onPress={() => setExportState('idle')}>
              <Text style={styles.exportButtonText}>Voltar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: 16 }}>
              <Tabs tabs={EXPORT_TABS} active={tab} onChange={setTab} scrollable />
            </View>

            <ScrollView contentContainerStyle={styles.tabContent}>
              {tab === 'RÁPIDO' && (
                <View style={{ gap: 20 }}>
                  <View>
                    <Text style={styles.sectionLabel}>Formato</Text>
                    <View style={styles.chipRow}>
                      {IMAGE_FORMATS.map((f) => (
                        <Pressable
                          key={f}
                          style={[styles.chip, format === f && styles.chipActive]}
                          onPress={() => setFormat(f)}
                        >
                          <Text style={[styles.chipText, format === f && styles.chipTextActive]}>
                            {f}
                          </Text>
                        </Pressable>
                      ))}
                      {HEIC_AVAILABLE && (
                        <Pressable
                          style={[styles.chip, format === 'HEIC' && styles.chipActive]}
                          onPress={() => setFormat('HEIC')}
                        >
                          <Text
                            style={[styles.chipText, format === 'HEIC' && styles.chipTextActive]}
                          >
                            HEIC
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {(format === 'JPEG' || format === 'PNG') && (
                    <View>
                      <Text style={styles.sectionLabel}>DPI</Text>
                      <View style={styles.chipRow}>
                        {DPI_OPTIONS.map((d) => (
                          <Pressable
                            key={d}
                            style={[styles.chip, dpi === d && styles.chipActive]}
                            onPress={() => setDpi(d)}
                          >
                            <Text style={[styles.chipTextMono, dpi === d && styles.chipTextActive]}>
                              {d}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  <View>
                    <View style={styles.qualityHeader}>
                      <Text style={styles.sectionLabel}>Qualidade</Text>
                      {format !== 'HEIC' && (
                        <Switch
                          value={smartCompression}
                          onChange={setSmartCompression}
                          label="Compressão inteligente"
                        />
                      )}
                    </View>
                    {smartCompression && format !== 'HEIC' ? (
                      <Slider
                        label="Tamanho alvo"
                        value={targetSizeMB}
                        min={0.5}
                        max={10}
                        step={0.5}
                        unit=" MB"
                        onChange={setTargetSizeMB}
                      />
                    ) : (
                      <Slider
                        label=""
                        value={quality}
                        min={10}
                        max={100}
                        unit="%"
                        onChange={setQuality}
                        labelWidth={0}
                      />
                    )}
                  </View>

                  <View>
                    <Text style={styles.sectionLabel}>Tamanho</Text>
                    <View style={styles.chipRow}>
                      {SIZE_PRESETS.map((s) => (
                        <Pressable
                          key={s.name}
                          style={[
                            styles.chip,
                            sizeChip === s.name && !socialPreset && styles.chipActive,
                          ]}
                          onPress={() => {
                            setSizeChip(s.name);
                            setSocialPreset(null);
                          }}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              sizeChip === s.name && !socialPreset && styles.chipTextActive,
                            ]}
                          >
                            {s.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text style={styles.sectionLabel}>Redes sociais</Text>
                    <View style={styles.socialGrid}>
                      {SOCIAL_PRESETS.map((p) => {
                        const active = socialPreset === p.name;
                        return (
                          <Pressable
                            key={p.name}
                            style={[styles.socialCard, active && styles.chipActive]}
                            onPress={() => setSocialPreset(active ? null : p.name)}
                          >
                            <Text style={styles.socialName}>{p.name}</Text>
                            <Text style={styles.socialRes}>
                              {p.width}×{p.height}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {tab === "MARCA D'ÁGUA" && (
                <View style={{ gap: 14 }}>
                  <View>
                    <Text style={styles.sectionLabel}>Texto</Text>
                    <TextInput
                      style={styles.wmInput}
                      value={wmText}
                      onChangeText={setWmText}
                      placeholder="Seu nome ou @perfil"
                      placeholderTextColor={colors.texto2}
                      maxLength={60}
                      autoCorrect={false}
                    />
                    <Text style={styles.wmHint}>
                      Deixe em branco para exportar sem marca d'água.
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.watermarkPreviewWrap,
                      {
                        justifyContent: GRID_ALIGN[Math.floor(wmPosition / 3)],
                        alignItems: GRID_ALIGN[wmPosition % 3],
                      },
                    ]}
                    onLayout={(e) => setPreviewWidth(e.nativeEvent.layout.width)}
                  >
                    <Text
                      style={[
                        styles.watermarkText,
                        {
                          opacity: opacity / 100,
                          transform: [{ rotate: `${wmRotation}deg` }],
                          fontSize: previewFontSize,
                          textShadowColor: `rgba(0, 0, 0, ${previewShadow.alpha})`,
                          textShadowOffset: {
                            width: previewShadow.offset,
                            height: previewShadow.offset,
                          },
                          textShadowRadius: previewShadow.blur,
                        },
                      ]}
                    >
                      {wmText.trim() || 'Seu texto'}
                    </Text>
                  </View>
                  <View style={styles.positionGrid}>
                    {WATERMARK_POSITIONS.map((p, i) => (
                      <Pressable
                        key={p}
                        style={[styles.positionCell, wmPosition === i && styles.positionCellActive]}
                        onPress={() => setWmPosition(i)}
                      >
                        <Text
                          style={[
                            styles.positionGlyph,
                            wmPosition === i && styles.positionGlyphActive,
                          ]}
                        >
                          {p}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Slider
                    label="Opacidade"
                    value={opacity}
                    min={0}
                    max={100}
                    onChange={setOpacity}
                  />
                  <Slider label="Tamanho" value={wmSize} min={5} max={80} onChange={setWmSize} />
                  <Slider
                    label="Rotação"
                    value={wmRotation}
                    min={-180}
                    max={180}
                    onChange={setWmRotation}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={styles.exportButton} onPress={handleExport}>
                <Text style={styles.exportButtonText}>EXPORTAR</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
    justifyContent: 'flex-end',
    backgroundColor: colors.veu,
  },
  sheet: {
    height: '88%',
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 32,
    height: 3,
    backgroundColor: colors.linha,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '500',
    color: colors.texto,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 24,
  },
  doneThumb: {
    width: 120,
    height: 90,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  doneCheck: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 28,
    height: 28,
    backgroundColor: colors.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.texto,
    textAlign: 'center',
  },
  doneMeta: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  saveButtonText: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedText: {
    flex: 0,
    color: colors.ok,
  },
  processingText: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  tabContent: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.texto2,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  chipActive: {
    borderColor: colors.acento,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  chipTextMono: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  chipTextActive: {
    color: colors.acento,
  },
  // The switch's label takes all the row's width, so it gets its own line under the title.
  qualityHeader: {
    gap: 8,
    marginBottom: 4,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  socialCard: {
    width: '48%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    gap: 2,
  },
  socialName: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  socialRes: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.texto2,
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.alerta,
    lineHeight: 16,
  },
  /** Overrides warningText's row-oriented flex:1 for standalone use in a centered column. */
  warningTextBlock: {
    flex: 0,
    textAlign: 'center',
  },
  watermarkPreviewWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.faixa,
    borderWidth: 1,
    borderColor: colors.linha,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 10,
  },
  watermarkText: {
    color: WATERMARK_COLOR,
  },
  wmInput: {
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  wmHint: {
    marginTop: 6,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  positionCell: {
    width: '31%',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.linha,
  },
  positionCellActive: {
    borderColor: colors.acento,
  },
  positionGlyph: {
    fontSize: 14,
    color: colors.texto2,
  },
  positionGlyphActive: {
    color: colors.acento,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  exportButton: {
    height: 44,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#0D2036',
  },
});
