import { useCallback, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
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
const CURVE_BOX_HEIGHT = 160;
const ZOOM_PREVIEW_SIZE = 140;
const ZOOM_FACTOR = 3;

/** Turns one channel's bin values (0..1) into a filled-area path, baseline-closed. */
function histogramToPath(values: number[], height = HISTOGRAM_VIEW_HEIGHT): string {
  const n = values.length;
  if (n === 0) return `M0,${height} Z`;
  const points = values.map((v, i) => {
    const x = ((i + 0.5) / n) * HISTOGRAM_VIEW_WIDTH;
    const y = height - v * height;
    return `L${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M0,${height} ${points.join(' ')} L${HISTOGRAM_VIEW_WIDTH},${height} Z`;
}

/** Piecewise-linear curve through (0,0)-(1/3,y1)-(2/3,y2)-(1,1) — mirrors evalCurve() in the shader. */
function curveToPath(y1: number, y2: number, width: number, height: number): string {
  const x0 = 0;
  const x1 = width / 3;
  const x2 = (width * 2) / 3;
  const x3 = width;
  const toY = (v: number) => height - v * height;
  return `M${x0},${toY(0)} L${x1},${toY(y1)} L${x2},${toY(y2)} L${x3},${toY(1)}`;
}

const TABS = ['Básico', 'Curvas', 'Detalhe', 'Cor seletiva'] as const;
type AdjustTab = (typeof TABS)[number];
const CURVE_CHANNELS = ['RGB', 'R', 'G', 'B'] as const;
type CurveChannel = (typeof CURVE_CHANNELS)[number];
const CURVE_CHANNEL_COLOR: Record<CurveChannel, string> = {
  RGB: colors.acento,
  R: 'rgb(210,82,82)',
  G: 'rgb(95,185,143)',
  B: 'rgb(58,143,222)',
};

function curveFieldPrefix(channel: CurveChannel): string {
  return channel === 'RGB' ? 'Master' : channel;
}

interface AdjustmentsLike {
  temperatura: number;
  tint: number;
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
  curveMasterY1: number;
  curveMasterY2: number;
  curveRY1: number;
  curveRY2: number;
  curveGY1: number;
  curveGY2: number;
  curveBY1: number;
  curveBY2: number;
  [key: string]: number;
}

interface CurveHandleProps {
  x: number;
  value: number;
  boxHeight: number;
  onChange: (v: number) => void;
  onCommitValue: (value: number, previousValue: number) => void;
}

/** One draggable curve control point — an invisible touch target; the visible dot is drawn in SVG. */
function CurveHandle({ x, value, boxHeight, onChange, onCommitValue }: CurveHandleProps) {
  const startValue = useRef(value);
  const latestValue = useRef(value);

  const updateFromDeltaY = useCallback(
    (deltaY: number) => {
      const next = Math.min(1, Math.max(0, startValue.current - deltaY / boxHeight));
      latestValue.current = next;
      onChange(next);
    },
    [boxHeight, onChange]
  );

  const commit = useCallback(() => {
    onCommitValue(latestValue.current, startValue.current);
  }, [onCommitValue]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startValue.current = value;
    })
    .onUpdate((e) => {
      runOnJS(updateFromDeltaY)(e.translationY);
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const cy = boxHeight - value * boxHeight;

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{
          position: 'absolute',
          left: x - 14,
          top: cy - 14,
          width: 28,
          height: 28,
        }}
      />
    </GestureDetector>
  );
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
  const [curveBoxWidth, setCurveBoxWidth] = useState(0);
  const onCurveBoxLayout = useCallback((e: LayoutChangeEvent) => {
    setCurveBoxWidth(e.nativeEvent.layout.width);
  }, []);

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
          {slider('Matiz de branco', 'tint', {
            min: -100,
            max: 100,
            gradientColors: ['#22C55E', '#D946EF'],
          })}
          {slider('Matiz', 'matiz', { min: -100, max: 100 })}
          {slider('Saturação', 'saturacao', { min: -100, max: 100 })}
          {slider('Luminosidade', 'luminosidade', { min: -100, max: 100 })}
          {slider('Vibração', 'vibracao', { min: -100, max: 100 })}
          {slider('Exposição', 'exposicao', { min: -3, max: 3 })}
        </View>
      )}
      {tab === 'Curvas' &&
        (() => {
          const prefix = curveFieldPrefix(curveChannel);
          const y1Field = `curve${prefix}Y1`;
          const y2Field = `curve${prefix}Y2`;
          const y1 = adjustments[y1Field];
          const y2 = adjustments[y2Field];
          const color = CURVE_CHANNEL_COLOR[curveChannel];
          const x1 = curveBoxWidth / 3;
          const x2 = (curveBoxWidth * 2) / 3;

          return (
            <View style={{ padding: 12 }}>
              <View style={styles.curveBox} onLayout={onCurveBoxLayout}>
                <Svg
                  width="100%"
                  height={CURVE_BOX_HEIGHT}
                  viewBox={`0 0 ${HISTOGRAM_VIEW_WIDTH} ${CURVE_BOX_HEIGHT}`}
                  preserveAspectRatio="none"
                  style={StyleSheet.absoluteFill}
                >
                  <Path
                    d={histogramToPath(histogram.r, CURVE_BOX_HEIGHT)}
                    fill="rgba(210,82,82,0.18)"
                  />
                  <Path
                    d={histogramToPath(histogram.g, CURVE_BOX_HEIGHT)}
                    fill="rgba(95,185,143,0.18)"
                  />
                  <Path
                    d={histogramToPath(histogram.b, CURVE_BOX_HEIGHT)}
                    fill="rgba(58,143,222,0.18)"
                  />
                </Svg>
                <Svg
                  width="100%"
                  height={CURVE_BOX_HEIGHT}
                  style={[StyleSheet.absoluteFill, { opacity: 0.2 }]}
                >
                  <Line x1="33%" y1="0" x2="33%" y2="100%" stroke={colors.texto} strokeWidth={1} />
                  <Line x1="66%" y1="0" x2="66%" y2="100%" stroke={colors.texto} strokeWidth={1} />
                  <Line x1="0" y1="33%" x2="100%" y2="33%" stroke={colors.texto} strokeWidth={1} />
                  <Line x1="0" y1="66%" x2="100%" y2="66%" stroke={colors.texto} strokeWidth={1} />
                  <Line x1="0" y1="100%" x2="100%" y2="0" stroke={colors.texto} strokeWidth={1} />
                </Svg>
                {curveBoxWidth > 0 && (
                  <Svg
                    width="100%"
                    height={CURVE_BOX_HEIGHT}
                    viewBox={`0 0 ${curveBoxWidth} ${CURVE_BOX_HEIGHT}`}
                    style={StyleSheet.absoluteFill}
                  >
                    <Path
                      d={curveToPath(y1, y2, curveBoxWidth, CURVE_BOX_HEIGHT)}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                    />
                    <Circle
                      cx={x1}
                      cy={CURVE_BOX_HEIGHT - y1 * CURVE_BOX_HEIGHT}
                      r={5}
                      fill={color}
                    />
                    <Circle
                      cx={x2}
                      cy={CURVE_BOX_HEIGHT - y2 * CURVE_BOX_HEIGHT}
                      r={5}
                      fill={color}
                    />
                  </Svg>
                )}
                {curveBoxWidth > 0 && (
                  <>
                    <CurveHandle
                      x={x1}
                      value={y1}
                      boxHeight={CURVE_BOX_HEIGHT}
                      onChange={(v) => setField(y1Field, v)}
                      onCommitValue={(v, from) => onCommit(y1Field, v, from)}
                    />
                    <CurveHandle
                      x={x2}
                      value={y2}
                      boxHeight={CURVE_BOX_HEIGHT}
                      onChange={(v) => setField(y2Field, v)}
                      onCommitValue={(v, from) => onCommit(y2Field, v, from)}
                    />
                  </>
                )}
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
          );
        })()}
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
