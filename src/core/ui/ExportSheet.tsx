import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, monoFontFamily } from '../theme';
import { Icon } from './Icon';
import { Slider } from './Slider';
import { Tabs } from './Tabs';

interface ExportSheetProps {
  onClose: () => void;
}

type ExportTab = 'RÁPIDO' | 'PROFISSIONAL' | "MARCA D'ÁGUA";
const EXPORT_TABS: readonly ExportTab[] = ['RÁPIDO', 'PROFISSIONAL', "MARCA D'ÁGUA"];

type ExportState = 'idle' | 'exporting' | 'done';

const FORMATS = ['JPEG', 'PNG', 'WebP', 'HEIC', 'GIF'];
const SIZES = ['Original', '2K', '1080p', '720p'];
const SOCIAL_PRESETS = [
  ['Instagram Feed', '1080×1080'],
  ['Instagram Story', '1080×1920'],
  ['Twitter / X', '1200×675'],
  ['LinkedIn', '1200×627'],
];
const PRO_OPTIONS = ['Manter camadas', 'Incluir máscaras', 'Incorporar perfil ICC'];
const DPI_OPTIONS = ['72', '150', '300', '600'];
const COLOR_SPACES = ['sRGB', 'Adobe RGB', 'DCI-P3'];
const WATERMARK_POSITIONS = ['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'];
const SHARE_ACTIONS = [
  { icon: 'save', label: 'Salvar' },
  { icon: 'upload', label: 'Enviar' },
  { icon: 'link', label: 'Copiar link' },
  { icon: 'printer', label: 'Imprimir' },
  { icon: 'share', label: 'Mais' },
];

const PREVIEW_URI =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=320&h=180&fit=crop&auto=format';

/**
 * Modal export sheet — covers 85% of the height over the current editor.
 * Rendered as an overlay by PhotoEditorScreen / VideoEditorScreen; not a route.
 */
export function ExportSheet({ onClose }: ExportSheetProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ExportTab>('RÁPIDO');
  const [format, setFormat] = useState('JPEG');
  const [quality, setQuality] = useState(85);
  const [sizeChip, setSizeChip] = useState('Original');
  const [dpi, setDpi] = useState('300');
  const [colorSpace, setColorSpace] = useState('Adobe RGB');
  const [proOptions, setProOptions] = useState<Record<string, boolean>>({
    'Manter camadas': true,
    'Incluir máscaras': true,
    'Incorporar perfil ICC': false,
  });
  const [wmPosition, setWmPosition] = useState(8);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [progress, setProgress] = useState(0);
  const [opacity, setOpacity] = useState(60);
  const [wmSize, setWmSize] = useState(20);
  const [wmRotation, setWmRotation] = useState(0);

  const estimatedSize = Math.max(1, Math.round(quality * 0.44));

  const handleExport = () => {
    // TODO: replace this fake progress timer with the real export pipeline.
    setExportState('exporting');
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15 + 5;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setProgress(100);
        setTimeout(() => setExportState('done'), 200);
      } else {
        setProgress(Math.round(p));
      }
    }, 120);
  };

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

        {exportState === 'done' ? (
          <View style={styles.centeredContent}>
            <View>
              {/* TODO: show the real exported file thumbnail. */}
              <Image source={{ uri: PREVIEW_URI }} style={styles.doneThumb} />
              <View style={styles.doneCheck}>
                <Icon name="check" size={16} color={colors.preto} />
              </View>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.doneTitle}>Exportação concluída</Text>
              <Text style={styles.doneMeta}>
                {format} · 6000×4000 · {estimatedSize} MB · 2,3 s
              </Text>
            </View>
            <View style={styles.shareRow}>
              {SHARE_ACTIONS.map(({ icon, label }) => (
                // TODO: wire real save / share / print integrations.
                <Pressable key={label} style={styles.shareButton}>
                  <Icon name={icon} size={18} />
                  <Text style={styles.shareLabel}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.exportButton} onPress={onClose}>
              <Text style={styles.exportButtonText}>Concluído</Text>
            </Pressable>
          </View>
        ) : exportState === 'exporting' ? (
          <View style={styles.centeredContent}>
            <Text style={styles.processingText}>Processando...</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{progress}%</Text>
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
                      {FORMATS.map((f) => (
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
                    </View>
                  </View>
                  <View>
                    <View style={styles.qualityHeader}>
                      <Text style={styles.sectionLabel}>Qualidade</Text>
                      <Text style={styles.qualityValue}>
                        {quality}% · ~{estimatedSize} MB
                      </Text>
                    </View>
                    <Slider
                      label=""
                      value={quality}
                      min={10}
                      max={100}
                      onChange={setQuality}
                      labelWidth={0}
                    />
                  </View>
                  <View>
                    <Text style={styles.sectionLabel}>Tamanho</Text>
                    <View style={styles.chipRow}>
                      {SIZES.map((s) => (
                        <Pressable
                          key={s}
                          style={[styles.chip, sizeChip === s && styles.chipActive]}
                          onPress={() => setSizeChip(s)}
                        >
                          <Text style={[styles.chipText, sizeChip === s && styles.chipTextActive]}>
                            {s}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View>
                    <Text style={styles.sectionLabel}>Redes sociais</Text>
                    <View style={styles.socialGrid}>
                      {SOCIAL_PRESETS.map(([name, res]) => (
                        // TODO: apply the real crop/export preset for this social size.
                        <Pressable key={name} style={styles.socialCard}>
                          <Text style={styles.socialName}>{name}</Text>
                          <Text style={styles.socialRes}>{res}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {tab === 'PROFISSIONAL' && (
                <View style={{ gap: 16 }}>
                  <View style={styles.proFormatGrid}>
                    {[
                      ['PSD', 'Adobe Photoshop'],
                      ['TIFF', 'Sem perdas'],
                    ].map(([fmt, desc]) => (
                      // TODO: implement real PSD/TIFF export with layer preservation.
                      <Pressable key={fmt} style={styles.proFormatCard}>
                        <Text style={styles.proFormatName}>{fmt}</Text>
                        <Text style={styles.proFormatDesc}>{desc}</Text>
                      </Pressable>
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
                  <View style={styles.warningBox}>
                    <Icon name="triangle" size={14} color={colors.alerta} />
                    <Text style={styles.warningText}>
                      Simulação CMYK pode alterar as cores do perfil RGB
                    </Text>
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
                  <View style={styles.watermarkPreviewWrap}>
                    {/* TODO: composite the real watermark text/QR over the actual export preview. */}
                    <Image source={{ uri: PREVIEW_URI }} style={styles.watermarkPreviewImage} />
                    <Text style={[styles.watermarkText, { opacity: opacity / 100 }]}>
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
    width: 80,
    height: 80,
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
  },
  doneMeta: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginTop: 4,
  },
  shareRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  shareButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  shareLabel: {
    fontSize: 9,
    color: colors.texto2,
    textAlign: 'center',
  },
  processingText: {
    fontSize: fontSize.md,
    color: colors.texto,
  },
  progressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: colors.linha,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.acento,
  },
  progressLabel: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.sm,
    color: colors.texto2,
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
  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qualityValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto,
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
  proFormatName: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.lg,
    color: colors.acento,
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
  },
  watermarkPreviewImage: {
    width: '100%',
    height: '100%',
    opacity: 0.65,
  },
  watermarkText: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    fontSize: fontSize.md,
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
