import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Canvas, Fill, ImageShader, Shader, Skia, useImage } from '@shopify/react-native-skia';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, Slider, Button } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { usePersistedHistory } from '@core/history';
import { createProjectsModule, createMediaAsset, createMediaMetadata } from '@modules/projects';
import { ADJUSTMENTS_SKSL, CURVE_IDENTITY, toFullUniforms } from '@modules/photo-editor/color';
import { errorLogger } from '@core/reliability';

type Props = NativeStackScreenProps<RootStackParamList, 'RawConverter'>;

const CURVE_BOX_HEIGHT = 160;

function curveToPath(y1: number, y2: number, width: number, height: number): string {
  const x1 = width / 3;
  const x2 = (width * 2) / 3;
  const toY = (v: number) => height - v * height;
  return `M0,${toY(0)} L${x1},${toY(y1)} L${x2},${toY(y2)} L${width},${toY(1)}`;
}

interface CurvePointProps {
  x: number;
  value: number;
  boxHeight: number;
  onChange: (v: number) => void;
}

/** One draggable tone-curve control point (Y-only drag) — an invisible touch target over the SVG dot. */
function CurvePoint({ x, value, boxHeight, onChange }: CurvePointProps) {
  const startValue = useRef(value);

  const updateFromDeltaY = useCallback(
    (deltaY: number) => {
      const next = Math.min(1, Math.max(0, startValue.current - deltaY / boxHeight));
      onChange(next);
    },
    [boxHeight, onChange]
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      startValue.current = value;
    })
    .onUpdate((e) => {
      runOnJS(updateFromDeltaY)(e.translationY);
    });

  const cy = boxHeight - value * boxHeight;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ position: 'absolute', left: x - 16, top: cy - 16, width: 32, height: 32 }} />
    </GestureDetector>
  );
}

/**
 * RF-003: internal RAW converter — real white-balance (temperature + tint) and tone-curve
 * controls, rendered live via the same GPU shader the main editor uses. There is no
 * sensor-level RAW decoder in this build (no custom native code / not ejected from Expo),
 * so this operates on the RAW file's embedded preview image — the same fallback every
 * non-RAW-aware viewer uses. "Aplicar" seeds a new project's edit history with these
 * starting values and hands off to the normal PhotoEditor flow (RF-003's "segue para o
 * fluxo normal de edição").
 */
export default function RawConverterScreen({ navigation, route }: Props) {
  const { sourceUri, sourceName, rawFormatLabel: formatLabel, rawMimeType } = route.params;

  const [temperature, setTemperature] = useState(0);
  const [tint, setTint] = useState(0);
  const [curveY1, setCurveY1] = useState(CURVE_IDENTITY.y1);
  const [curveY2, setCurveY2] = useState(CURVE_IDENTITY.y2);
  const [curveBoxWidth, setCurveBoxWidth] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const moduleRef = useRef(createProjectsModule());
  const history = usePersistedHistory(projectId ?? 'raw-converter-pending');

  const onCurveBoxLayout = useCallback((e: LayoutChangeEvent) => {
    setCurveBoxWidth(e.nativeEvent.layout.width);
  }, []);

  const projectCreationStarted = useRef(false);

  useEffect(() => {
    // Guards against a second project being created if this effect is ever re-invoked
    // on an already-mounted screen (e.g. a Fast Refresh remount during development).
    if (projectCreationStarted.current) return;
    projectCreationStarted.current = true;
    let cancelled = false;
    moduleRef.current.createProject
      .execute(sourceName, 'photo')
      .then((project) =>
        moduleRef.current.addMediaAsset.execute(
          project.id,
          createMediaAsset(
            `asset_${Date.now()}`,
            'image',
            sourceUri,
            sourceUri,
            createMediaMetadata(rawMimeType)
          )
        )
      )
      .then((project) => {
        if (!cancelled) setProjectId(project.id);
      })
      .catch((error) => errorLogger.log(error, 'RawConverterScreen.createProject'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skiaImage = useImage(sourceUri);
  const adjustmentsEffect = useMemo(() => Skia.RuntimeEffect.Make(ADJUSTMENTS_SKSL), []);
  const uniforms = useMemo(
    () =>
      toFullUniforms(
        {
          temperatura: temperature,
          tint,
          matiz: 0,
          saturacao: 0,
          luminosidade: 0,
          vibracao: 0,
          exposicao: 0,
        },
        { nitidez: 0, raio: 1, reducaoRuido: 0, luminancia: 0 },
        { colorIndex: null, tolerancia: 50, matiz: 0, saturacao: 0, luminosidade: 0 },
        {
          master: { y1: curveY1, y2: curveY2 },
          r: CURVE_IDENTITY,
          g: CURVE_IDENTITY,
          b: CURVE_IDENTITY,
        }
      ),
    [temperature, tint, curveY1, curveY2]
  );

  const applyAndContinue = useCallback(() => {
    if (!projectId || !history.ready || applying) return;
    setApplying(true);
    if (temperature !== 0) history.push('temperatura', 0, temperature);
    if (tint !== 0) history.push('tint', 0, tint);
    if (curveY1 !== CURVE_IDENTITY.y1) history.push('curveMasterY1', CURVE_IDENTITY.y1, curveY1);
    if (curveY2 !== CURVE_IDENTITY.y2) history.push('curveMasterY2', CURVE_IDENTITY.y2, curveY2);
    navigation.replace('PhotoEditor', { projectId });
  }, [projectId, history, applying, temperature, tint, curveY1, curveY2, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevronLeft" size={20} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            Conversor RAW
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {sourceName} · {formatLabel}
          </Text>
        </View>
      </View>

      <View style={styles.previewWrap}>
        {skiaImage && adjustmentsEffect ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <Fill>
              <Shader source={adjustmentsEffect} uniforms={uniforms}>
                <ImageShader
                  image={skiaImage}
                  fit="contain"
                  rect={{ x: 0, y: 0, width: 320, height: 320 }}
                />
              </Shader>
            </Fill>
          </Canvas>
        ) : null}
      </View>
      <Text style={styles.hintText}>
        Usando a pré-visualização incorporada do arquivo RAW — a decodificação do sensor
        (demosaicing) exige uma biblioteca nativa fora do gerenciamento do Expo.
      </Text>

      <View style={{ padding: 12 }}>
        <Text style={styles.sectionLabel}>Balanço de branco</Text>
        <Slider
          label="Temperatura"
          value={temperature}
          min={-100}
          max={100}
          bipolar
          showSign
          gradientColors={['#4477FF', '#FF8833']}
          onChange={setTemperature}
        />
        <Slider
          label="Matiz de branco"
          value={tint}
          min={-100}
          max={100}
          bipolar
          showSign
          gradientColors={['#22C55E', '#D946EF']}
          onChange={setTint}
        />

        <Text style={styles.sectionLabel}>Curva de tons</Text>
        <View style={styles.curveBox} onLayout={onCurveBoxLayout}>
          {curveBoxWidth > 0 && (
            <>
              <Svg
                width="100%"
                height={CURVE_BOX_HEIGHT}
                viewBox={`0 0 ${curveBoxWidth} ${CURVE_BOX_HEIGHT}`}
                style={StyleSheet.absoluteFill}
              >
                <Line x1="33%" y1="0" x2="33%" y2="100%" stroke={colors.linha} strokeWidth={1} />
                <Line x1="66%" y1="0" x2="66%" y2="100%" stroke={colors.linha} strokeWidth={1} />
                <Path
                  d={curveToPath(curveY1, curveY2, curveBoxWidth, CURVE_BOX_HEIGHT)}
                  fill="none"
                  stroke={colors.acento}
                  strokeWidth={2}
                />
                <Circle
                  cx={curveBoxWidth / 3}
                  cy={CURVE_BOX_HEIGHT - curveY1 * CURVE_BOX_HEIGHT}
                  r={5}
                  fill={colors.acento}
                />
                <Circle
                  cx={(curveBoxWidth * 2) / 3}
                  cy={CURVE_BOX_HEIGHT - curveY2 * CURVE_BOX_HEIGHT}
                  r={5}
                  fill={colors.acento}
                />
              </Svg>
              <CurvePoint
                x={curveBoxWidth / 3}
                value={curveY1}
                boxHeight={CURVE_BOX_HEIGHT}
                onChange={setCurveY1}
              />
              <CurvePoint
                x={(curveBoxWidth * 2) / 3}
                value={curveY2}
                boxHeight={CURVE_BOX_HEIGHT}
                onChange={setCurveY2}
              />
            </>
          )}
        </View>

        <Button
          label={applying ? 'ABRINDO EDITOR…' : 'APLICAR E ABRIR NO EDITOR'}
          onPress={applyAndContinue}
          disabled={!projectId || !history.ready || applying}
          style={{ marginTop: 16 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topBar: {
    height: 48,
    backgroundColor: colors.barra,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  title: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  previewWrap: {
    width: 320,
    height: 320,
    alignSelf: 'center',
    marginTop: 16,
    backgroundColor: colors.faixa,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  hintText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    textAlign: 'center',
    marginHorizontal: 24,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.texto2,
    marginBottom: 4,
    marginTop: 8,
  },
  curveBox: {
    height: CURVE_BOX_HEIGHT,
    backgroundColor: colors.faixa,
    borderWidth: 1,
    borderColor: colors.linha,
  },
});
