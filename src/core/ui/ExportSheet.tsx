import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SkImage } from '@shopify/react-native-skia';
import {
  IMAGE_FORMATS,
  UNSUPPORTED_IMAGE_FORMATS,
  SIZE_PRESETS,
  SOCIAL_PRESETS,
  formatBytes,
  encodeImage,
  encodeToTargetSize,
  resizeImageCover,
  resizeImageToFit,
  type EncodedImage,
  type ImageExportFormat,
} from '@modules/export';
import { saveImageToGallery } from '@modules/device-media';
import { errorLogger } from '@core/reliability';
import { colors, fontSize, monoFontFamily } from '../theme';
import { Icon } from './Icon';
import { Slider } from './Slider';
import { Switch } from './Switch';
import { Tabs } from './Tabs';

interface ExportSheetProps {
  onClose: () => void;
  /** Which pipeline this sheet is exporting from — video has no real encoder in this build. */
  mediaKind?: 'photo' | 'video';
  /** RF-057: real Skia snapshot of the current edit, e.g. `() => canvasRef.current?.makeImageSnapshot() ?? null`. */
  getSourceImage?: () => SkImage | null;
}

type ExportTab = 'RÁPIDO' | 'PROFISSIONAL' | "MARCA D'ÁGUA";
const EXPORT_TABS: readonly ExportTab[] = ['RÁPIDO', 'PROFISSIONAL', "MARCA D'ÁGUA"];

type ExportState = 'idle' | 'exporting' | 'done' | 'error';

const PRO_OPTIONS = ['Manter camadas', 'Incluir máscaras', 'Incorporar perfil ICC'];
const DPI_OPTIONS = ['72', '150', '300', '600'];
const COLOR_SPACES = ['sRGB', 'Adobe RGB', 'DCI-P3'];
const WATERMARK_POSITIONS = ['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'];

/**
 * Modal export sheet — covers ~88% of the height over the current editor. Rendered as an
 * overlay by PhotoEditorScreen / VideoEditorScreen; not a route.
 *
 * RF-057: photo export is genuinely real — it encodes the editor's actual Skia canvas
 * snapshot to JPEG/PNG/WebP bytes via Skia's own encoder. RNF-013's "smart compression" is
 * a real binary search against the encoder's own output size. Video export, PSD/TIFF, GIF
 * and HEIC all need an encoder this build doesn't have (FFmpeg-class / native image codecs),
 * and are flagged as such rather than faked.
 */
export function ExportSheet({ onClose, mediaKind = 'photo', getSourceImage }: ExportSheetProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ExportTab>('RÁPIDO');
  const [format, setFormat] = useState<ImageExportFormat>('JPEG');
  const [quality, setQuality] = useState(85);
  const [sizeChip, setSizeChip] = useState('Original');
  const [socialPreset, setSocialPreset] = useState<string | null>(null);
  const [smartCompression, setSmartCompression] = useState(false);
  const [targetSizeMB, setTargetSizeMB] = useState(2);
  const [dpi, setDpi] = useState('300');
  const [colorSpace, setColorSpace] = useState('Adobe RGB');
  const [proOptions, setProOptions] = useState<Record<string, boolean>>({
    'Manter camadas': true,
    'Incluir máscaras': true,
    'Incorporar perfil ICC': false,
  });
  const [wmPosition, setWmPosition] = useState(8);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<EncodedImage | null>(null);
  const [opacity, setOpacity] = useState(60);
  const [wmSize, setWmSize] = useState(20);
  const [wmRotation, setWmRotation] = useState(0);
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
    const source = getSourceImage();
    if (!source) {
      setExportState('error');
      setErrorMessage('Não foi possível capturar a imagem atual do editor.');
      return;
    }

    setExportState('exporting');
    setSaveState('idle');
    // Let "Processando..." paint before the (synchronous) encode work runs.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const image = socialPreset
        ? resizeImageCover(
            source,
            SOCIAL_PRESETS.find((p) => p.name === socialPreset)!.width,
            SOCIAL_PRESETS.find((p) => p.name === socialPreset)!.height
          )
        : resizeImageToFit(
            source,
            (SIZE_PRESETS.find((p) => p.name === sizeChip) ?? SIZE_PRESETS[0]).maxLongEdge
          );

      const encoded = smartCompression
        ? encodeToTargetSize(image, format, Math.round(targetSizeMB * 1024 * 1024))
        : encodeImage(image, format, quality);

      setResult(encoded);
      setExportState('done');
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
                  uri: `data:image/${result.format.toLowerCase()};base64,${result.base64}`,
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
                      {UNSUPPORTED_IMAGE_FORMATS.map((f) => (
                        <View key={f} style={[styles.chip, styles.chipDisabled]}>
                          <Text style={styles.chipTextDisabled}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View>
                    <View style={styles.qualityHeader}>
                      <Text style={styles.sectionLabel}>Qualidade</Text>
                      <Switch
                        value={smartCompression}
                        onChange={setSmartCompression}
                        label="Compressão inteligente"
                      />
                    </View>
                    {smartCompression ? (
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

              {tab === 'PROFISSIONAL' && (
                <View style={{ gap: 16 }}>
                  <View style={styles.warningBox}>
                    <Icon name="triangle" size={14} color={colors.alerta} />
                    <Text style={styles.warningText}>
                      Exportação PSD/TIFF exige um codificador dedicado, não incluído neste build —
                      os controles abaixo ficam registrados, mas o botão Exportar usa o formato
                      escolhido na aba Rápido.
                    </Text>
                  </View>
                  <View style={styles.proFormatGrid}>
                    {[
                      ['PSD', 'Adobe Photoshop'],
                      ['TIFF', 'Sem perdas'],
                    ].map(([fmt, desc]) => (
                      <View key={fmt} style={[styles.proFormatCard, styles.chipDisabled]}>
                        <Text style={styles.proFormatNameDisabled}>{fmt}</Text>
                        <Text style={styles.proFormatDesc}>{desc}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ gap: 10 }}>
                    {PRO_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt}
                        style={styles.checkboxRow}
                        onPress={() => setProOptions((prev) => ({ ...prev, [opt]: !prev[opt] }))}
                      >
                        <View style={[styles.checkbox, proOptions[opt] && styles.checkboxChecked]}>
                          {proOptions[opt] && <Icon name="check" size={10} color={colors.acento} />}
                        </View>
                        <Text style={styles.checkboxLabel}>{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
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
                  <View>
                    <Text style={styles.sectionLabel}>Espaço de cor</Text>
                    {COLOR_SPACES.map((cs) => (
                      <Pressable key={cs} style={styles.radioRow} onPress={() => setColorSpace(cs)}>
                        <View style={[styles.radio, colorSpace === cs && styles.radioActive]} />
                        <Text style={styles.checkboxLabel}>{cs}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {tab === "MARCA D'ÁGUA" && (
                <View style={{ gap: 14 }}>
                  <View style={styles.warningBox}>
                    <Icon name="triangle" size={14} color={colors.alerta} />
                    <Text style={styles.warningText}>
                      Pré-visualização apenas — a marca d'água ainda não é composta no arquivo
                      exportado nesta versão.
                    </Text>
                  </View>
                  <View style={styles.watermarkPreviewWrap}>
                    <Text
                      style={[
                        styles.watermarkText,
                        {
                          opacity: opacity / 100,
                          transform: [{ rotate: `${wmRotation}deg` }],
                          fontSize: 10 + wmSize * 0.3,
                        },
                      ]}
                    >
                      @joaosilva
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
  chipTextDisabled: {
    fontSize: fontSize.xs,
    color: colors.linha,
  },
  chipTextMono: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  chipTextActive: {
    color: colors.acento,
  },
  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  proFormatGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  proFormatCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    gap: 4,
  },
  proFormatNameDisabled: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.lg,
    color: colors.texto2,
  },
  proFormatDesc: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.acento,
  },
  checkboxLabel: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(210,160,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(210,160,94,0.3)',
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
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  radio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  radioActive: {
    borderColor: colors.acento,
    backgroundColor: colors.acento,
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
    color: colors.texto,
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
