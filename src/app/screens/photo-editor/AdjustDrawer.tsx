import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import {
  Canvas,
  Fill,
  ImageShader,
  Shader,
  type SkImage,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import { Slider, Tabs } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import {
  SELECTIVE_COLOR_NAMES,
  type FullAdjustmentUniforms,
  type RGBHistogram,
} from '@modules/photo-editor/color';

const HISTOGRAM_VIEW_WIDTH = 256;
const HISTOGRAM_VIEW_HEIGHT = 56;
const ZOOM_PREVIEW_SIZE = 140;
const ZOOM_FACTOR = 3;

/** Turns one channel's bin values (0..1) into a filled-area path, baseline-closed. */
function histogramToPath(values: number[]): string {
  const n = values.length;
  if (n === 0) return `M0,${HISTOGRAM_VIEW_HEIGHT} Z`;
  const points = values.map((v, i) => {
    const x = ((i + 0.5) / n) * HISTOGRAM_VIEW_WIDTH;
    const y = HISTOGRAM_VIEW_HEIGHT - v * HISTOGRAM_VIEW_HEIGHT;
    return `L${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M0,${HISTOGRAM_VIEW_HEIGHT} ${points.join(' ')} L${HISTOGRAM_VIEW_WIDTH},${HISTOGRAM_VIEW_HEIGHT} Z`;
}

const TABS = ['Básico', 'Curvas', 'Detalhe', 'Cor seletiva'] as const;
type AdjustTab = (typeof TABS)[number];
const CURVE_CHANNELS = ['RGB', 'R', 'G', 'B'] as const;
type CurveChannel = (typeof CURVE_CHANNELS)[number];

interface AdjustmentsLike {
  temperatura: number;
  matiz: number;
  saturacao: number;
  luminosidade: number;
  vibracao: number;
  exposicao: number;
  nitidez: number;
  raio: number;
  reducaoRuido: number;
  luminancia: number;
  corIndex: number;
  corTolerancia: number;
  corMatiz: number;
  corSaturacao: number;
  corLuminosidade: number;
  [key: string]: number;
}

interface AdjustDrawerProps {
  adjustments: AdjustmentsLike;
  setField: (field: string, value: number) => void;
  /** Called once per completed drag/tap so the caller can record an undo/redo entry. */
  onCommit: (field: string, value: number, previousValue: number) => void;
  /** RF-047: real live RGB histogram, recomputed by the screen from the decoded image. */
  histogram: RGBHistogram;
  /** RF-063 zoom preview: same decoded image + shader the main canvas uses. */
  skiaImage: SkImage | null;
  adjustmentsEffect: SkRuntimeEffect | null;
  uniforms: FullAdjustmentUniforms;
}

/** Ajustes drawer: Básico (live RGB histogram + tone sliders), Curvas, Detalhe, Cor seletiva. */
export function AdjustDrawer({
  adjustments,
  setField,
  onCommit,
  histogram,
  skiaImage,
  adjustmentsEffect,
  uniforms,
}: AdjustDrawerProps) {
  const [tab, setTab] = useState<AdjustTab>('Básico');
  const [curveChannel, setCurveChannel] = useState<CurveChannel>('RGB');
  // TODO: Curvas tab below is a read-only placeholder — RF-029's per-channel tone curve
  // editor (draggable control points + matching live histogram) isn't wired yet.

  const slider = (
    label: string,
    field: string,
    opts: { min: number; max: number; gradientColors?: readonly [string, string] }
  ) => (
    <Slider
      label={label}
      value={adjustments[field]}
      min={opts.min}
      max={opts.max}
      bipolar={opts.min < 0}
      showSign={opts.min < 0}
      gradientColors={opts.gradientColors}
      onChange={(v) => setField(field, v)}
      onSlidingComplete={(v, from) => onCommit(field, v, from)}
    />
  );

  const previewRect = skiaImage
    ? {
        x: -((skiaImage.width() * ZOOM_FACTOR - ZOOM_PREVIEW_SIZE) / 2),
        y: -((skiaImage.height() * ZOOM_FACTOR - ZOOM_PREVIEW_SIZE) / 2),
        width: skiaImage.width() * ZOOM_FACTOR,
        height: skiaImage.height() * ZOOM_FACTOR,
      }
    : null;

  return (
    <View>
      <Tabs tabs={TABS} active={tab} onChange={setTab} scrollable />
      {tab === 'Básico' && (
        <View>
          <View style={styles.histogram}>
            <Svg
              width="100%"
              height={HISTOGRAM_VIEW_HEIGHT}
              viewBox={`0 0 ${HISTOGRAM_VIEW_WIDTH} ${HISTOGRAM_VIEW_HEIGHT}`}
              preserveAspectRatio="none"
            >
              <Path d={histogramToPath(histogram.r)} fill="rgba(210,82,82,0.45)" />
              <Path d={histogramToPath(histogram.g)} fill="rgba(95,185,143,0.45)" />
              <Path d={histogramToPath(histogram.b)} fill="rgba(58,143,222,0.45)" />
            </Svg>
          </View>
          {slider('Temperatura', 'temperatura', {
            min: -100,
            max: 100,
            gradientColors: ['#4477FF', '#FF8833'],
          })}
          {slider('Matiz', 'matiz', { min: -100, max: 100 })}
          {slider('Saturação', 'saturacao', { min: -100, max: 100 })}
          {slider('Luminosidade', 'luminosidade', { min: -100, max: 100 })}
          {slider('Vibração', 'vibracao', { min: -100, max: 100 })}
          {slider('Exposição', 'exposicao', { min: -3, max: 3 })}
        </View>
      )}
      {tab === 'Curvas' && (
        <View style={{ padding: 12 }}>
          <View style={styles.curveBox}>
            {/* TODO: real editable curve — drag control points and recompute the tone curve per channel. */}
            <Svg
              width="100%"
              height={160}
              viewBox="0 0 256 160"
              preserveAspectRatio="none"
              style={StyleSheet.absoluteFill}
            >
              <Path
                d="M0,160 C30,158 50,126 80,52 C100,8 116,22 132,42 C152,66 182,114 222,146 C242,154 252,158 256,160 Z"
                fill="rgba(210,82,82,0.18)"
              />
              <Path
                d="M0,160 C20,160 40,143 70,74 C95,22 116,38 142,54 C167,78 186,118 216,146 C236,154 248,160 256,160 Z"
                fill="rgba(95,185,143,0.18)"
              />
              <Path
                d="M0,160 C14,158 28,134 54,58 C74,6 95,20 116,38 C142,60 172,109 212,146 C233,154 246,160 256,160 Z"
                fill="rgba(58,143,222,0.18)"
              />
            </Svg>
            <Svg width="100%" height={160} style={[StyleSheet.absoluteFill, { opacity: 0.2 }]}>
              <Line x1="33%" y1="0" x2="33%" y2="100%" stroke={colors.texto} strokeWidth={1} />
              <Line x1="66%" y1="0" x2="66%" y2="100%" stroke={colors.texto} strokeWidth={1} />
              <Line x1="0" y1="33%" x2="100%" y2="33%" stroke={colors.texto} strokeWidth={1} />
              <Line x1="0" y1="66%" x2="100%" y2="66%" stroke={colors.texto} strokeWidth={1} />
              <Line x1="0" y1="100%" x2="100%" y2="0" stroke={colors.texto} strokeWidth={1} />
            </Svg>
            <Svg width="100%" height={160} viewBox="0 0 160 160" style={StyleSheet.absoluteFill}>
              <Path
                d="M0,160 C40,155 55,120 80,80 C105,40 120,8 160,0"
                fill="none"
                stroke={colors.acento}
                strokeWidth={2}
              />
              <Circle cx={80} cy={80} r={5} fill={colors.acento} />
              <Circle cx={120} cy={38} r={5} fill={colors.acento} />
            </Svg>
          </View>
          <View style={styles.channelRow}>
            {CURVE_CHANNELS.map((c) => (
              <Pressable
                key={c}
                style={[styles.channelChip, curveChannel === c && styles.channelChipActive]}
                onPress={() => setCurveChannel(c)}
              >
                <Text
                  style={[
                    styles.channelChipText,
                    curveChannel === c && styles.channelChipTextActive,
                  ]}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {tab === 'Detalhe' && (
        <View>
          <View style={styles.zoomPreviewRow}>
            <View style={styles.zoomPreviewBox}>
              {skiaImage && adjustmentsEffect && previewRect ? (
                <Canvas style={StyleSheet.absoluteFill}>
                  <Fill>
                    <Shader source={adjustmentsEffect} uniforms={uniforms}>
                      <ImageShader image={skiaImage} fit="fill" rect={previewRect} />
                    </Shader>
                  </Fill>
                </Canvas>
              ) : null}
            </View>
            <Text style={styles.zoomPreviewLabel}>
              Pré-visualização em {ZOOM_FACTOR}× para avaliar nitidez e ruído
            </Text>
          </View>
          {slider('Nitidez', 'nitidez', { min: 0, max: 100 })}
          {slider('Raio', 'raio', { min: 0, max: 5 })}
          {slider('Redução ruído', 'reducaoRuido', { min: 0, max: 100 })}
          {slider('Luminância', 'luminancia', { min: 0, max: 100 })}
        </View>
      )}
      {tab === 'Cor seletiva' && (
        <View style={{ padding: 12 }}>
          <View style={styles.colorChipRow}>
            {SELECTIVE_COLOR_NAMES.map((name, i) => {
              const active = adjustments.corIndex === i;
              return (
                <Pressable
                  key={name}
                  style={[styles.colorChip, active && styles.colorChipActive]}
                  onPress={() => onCommit('corIndex', active ? -1 : i, adjustments.corIndex)}
                >
                  <Text style={[styles.colorChipText, active && styles.colorChipTextActive]}>
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {slider('Tolerância', 'corTolerancia', { min: 0, max: 100 })}
          {slider('Matiz', 'corMatiz', { min: -100, max: 100 })}
          {slider('Saturação', 'corSaturacao', { min: -100, max: 100 })}
          {slider('Luminosidade', 'corLuminosidade', { min: -100, max: 100 })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  histogram: {
    marginHorizontal: 12,
    marginVertical: 8,
    height: 56,
    backgroundColor: colors.faixa,
    borderWidth: 1,
    borderColor: colors.linha,
    overflow: 'hidden',
  },
  curveBox: {
    height: 160,
    backgroundColor: colors.faixa,
    borderWidth: 1,
    borderColor: colors.linha,
    overflow: 'hidden',
  },
  channelRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  channelChip: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  channelChipActive: {
    borderColor: colors.acento,
  },
  channelChipText: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  channelChipTextActive: {
    color: colors.acento,
  },
  zoomPreviewRow: {
    alignItems: 'center',
    marginVertical: 8,
    gap: 6,
  },
  zoomPreviewBox: {
    width: ZOOM_PREVIEW_SIZE,
    height: ZOOM_PREVIEW_SIZE,
    backgroundColor: colors.faixa,
    borderWidth: 1,
    borderColor: colors.linha,
    overflow: 'hidden',
  },
  zoomPreviewLabel: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  colorChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  colorChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  colorChipActive: {
    borderColor: colors.acento,
  },
  colorChipText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  colorChipTextActive: {
    color: colors.acento,
  },
});
