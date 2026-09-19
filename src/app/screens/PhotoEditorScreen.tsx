import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import {
  Canvas,
  Fill,
  Group,
  ImageShader,
  Path,
  Shader,
  Skia,
  useCanvasRef,
  useImage,
} from '@shopify/react-native-skia';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, ExportSheet } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { usePersistedHistory } from '@core/history';
import { createProjectsModule } from '@modules/projects';
import { errorLogger } from '@core/reliability';
import {
  ADJUSTMENTS_SKSL,
  CURVE_IDENTITY,
  toFullUniforms,
  useImageHistogram,
} from '@modules/photo-editor/color';
import {
  computeHomography,
  orientationToTransform,
  readExifOrientation,
  type Point,
} from '@modules/photo-editor/geometry';
import {
  createPaintLayer,
  createStrokeId,
  duplicateLayer,
  mergeVisiblePaintLayers,
  type EditorLayer,
} from '@modules/photo-editor/layers';
import {
  RETRO_EFFECTS_SKSL,
  toRetroUniforms,
  blendModeAt,
  DEFAULT_DOUBLE_EXPOSURE_BLEND,
  DEFAULT_DOUBLE_EXPOSURE_OPACITY,
} from '@modules/photo-editor/effects';
import { AdjustDrawer } from './photo-editor/AdjustDrawer';
import { GeometryDrawer } from './photo-editor/GeometryDrawer';
import { PerspectiveHandles } from './photo-editor/PerspectiveHandles';
import { LightPositionHandle } from './photo-editor/LightPositionHandle';
import { FrameOverlay } from './photo-editor/FrameOverlay';
import { LightEffectOverlay } from './photo-editor/LightEffectOverlay';
import { MasksDrawer } from './photo-editor/MasksDrawer';
import { RetouchDrawer } from './photo-editor/RetouchDrawer';
import { EffectsDrawer, type DoubleExposureImage } from './photo-editor/EffectsDrawer';
import { ElementsDrawer } from './photo-editor/ElementsDrawer';
import { AIDrawer } from './photo-editor/AIDrawer';
import { PresetsDrawer } from './photo-editor/PresetsDrawer';
import { LayersPanel } from './photo-editor/LayersPanel';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoEditor'>;

type Tool =
  | 'ajustes'
  | 'geometria'
  | 'mascaras'
  | 'retoque'
  | 'camadas'
  | 'efeitos'
  | 'elementos'
  | 'ia'
  | 'presets'
  | null;

const TOOLBAR = [
  { id: 'ajustes', icon: 'sliders', label: 'Ajustes' },
  { id: 'geometria', icon: 'crop', label: 'Geometria' },
  { id: 'mascaras', icon: 'mask', label: 'Máscaras' },
  { id: 'retoque', icon: 'retouch', label: 'Retoque' },
  { id: 'camadas', icon: 'layers', label: 'Camadas' },
  { id: 'efeitos', icon: 'effects', label: 'Efeitos' },
  { id: 'elementos', icon: 'type', label: 'Elementos' },
  { id: 'ia', icon: 'robot', label: 'IA' },
  { id: 'presets', icon: 'preset', label: 'Presets' },
] as const;

// Fallback only for the no-project spike entry point — every real project uses its own
// imported asset (see projectPhotoUri).
const DEMO_PHOTO_URI =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=533&fit=crop&auto=format';
const PHOTO_WIDTH = 340;
const PHOTO_HEIGHT = 227;
const BRUSH_COLORS = ['#E5484D', '#F5A623', '#F5D90A', '#30A46C', '#3B82F6', '#FFFFFF', '#000000'];

interface Adjustments {
  // Básico (RF-047)
  temperatura: number;
  tint: number; // RF-003 white balance's green<->magenta axis
  matiz: number;
  saturacao: number;
  luminosidade: number;
  vibracao: number;
  exposicao: number;
  // Detalhe (RF-063)
  nitidez: number;
  raio: number;
  reducaoRuido: number;
  luminancia: number;
  // Cor seletiva (RF-059) — corIndex -1 means "no color selected".
  corIndex: number;
  corTolerancia: number;
  corMatiz: number;
  corSaturacao: number;
  corLuminosidade: number;
  // Curvas (RF-029) — piecewise-linear per channel, see colorAdjustments.ts.
  curveMasterY1: number;
  curveMasterY2: number;
  curveRY1: number;
  curveRY2: number;
  curveGY1: number;
  curveGY2: number;
  curveBY1: number;
  curveBY2: number;
  // Geometria (US-05): rotation, mirror, and 4-point perspective — see geometry/.
  rotation90: number; // 0 | 90 | 180 | 270
  fineRotation: number; // -45..45 (horizon straighten)
  flipH: number; // 0 | 1
  flipV: number; // 0 | 1
  mirrorOpacity: number; // 0..100
  perspX0: number;
  perspY0: number;
  perspX1: number;
  perspY1: number;
  perspX2: number;
  perspY2: number;
  perspX3: number;
  perspY3: number;
  // Efeitos — Retrô (RF-041): envelhecimento/granulado/vinheta, each with its own blend.
  retroAging: number;
  retroAgingBlend: number;
  retroGrain: number;
  retroGrainBlend: number;
  retroVignette: number;
  retroVignetteBlend: number;
  // Efeitos — Overlays (RF-028): procedural textures from the internal repository.
  overlayType: number;
  overlayIntensity: number;
  overlayOpacity: number;
  // Efeitos — Molduras (RF-060).
  frameStyle: number;
  frameThickness: number;
  frameRadius: number;
  // Efeitos — Iluminação (RF-068).
  lightType: number;
  lightX: number;
  lightY: number;
  lightIntensity: number;
  // Efeitos — Dupla exposição (RF-075).
  doubleExposureBlend: number;
  doubleExposureOpacity: number;
  [key: string]: number;
}

const DEFAULT_ADJUSTMENTS: Adjustments = {
  temperatura: 0,
  tint: 0,
  matiz: 0,
  saturacao: 0,
  luminosidade: 0,
  vibracao: 0,
  exposicao: 0,
  nitidez: 0,
  raio: 1,
  reducaoRuido: 0,
  luminancia: 0,
  corIndex: -1,
  corTolerancia: 50,
  corMatiz: 0,
  corSaturacao: 0,
  corLuminosidade: 0,
  curveMasterY1: CURVE_IDENTITY.y1,
  curveMasterY2: CURVE_IDENTITY.y2,
  curveRY1: CURVE_IDENTITY.y1,
  curveRY2: CURVE_IDENTITY.y2,
  curveGY1: CURVE_IDENTITY.y1,
  curveGY2: CURVE_IDENTITY.y2,
  curveBY1: CURVE_IDENTITY.y1,
  curveBY2: CURVE_IDENTITY.y2,
  rotation90: 0,
  fineRotation: 0,
  flipH: 0,
  flipV: 0,
  mirrorOpacity: 100,
  perspX0: 0,
  perspY0: 0,
  perspX1: 1,
  perspY1: 0,
  perspX2: 1,
  perspY2: 1,
  perspX3: 0,
  perspY3: 1,
  retroAging: 0,
  retroAgingBlend: 100,
  retroGrain: 0,
  retroGrainBlend: 100,
  retroVignette: 0,
  retroVignetteBlend: 100,
  overlayType: 0,
  overlayIntensity: 60,
  overlayOpacity: 0,
  frameStyle: 0,
  frameThickness: 30,
  frameRadius: 30,
  lightType: 0,
  lightX: 0.78,
  lightY: 0.22,
  lightIntensity: 0,
  doubleExposureBlend: DEFAULT_DOUBLE_EXPOSURE_BLEND,
  doubleExposureOpacity: DEFAULT_DOUBLE_EXPOSURE_OPACITY,
};

function pointsToPath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M${first.x},${first.y} ${rest.map((p) => `L${p.x},${p.y}`).join(' ')}`;
}

export default function PhotoEditorScreen({ navigation, route }: Props) {
  const projectId = route.params?.projectId;
  // Falls back to a fixed key so the spike/dev entry point (no project id) still gets
  // working undo/redo instead of crashing — RF-027 just won't survive across app restarts.
  const sessionId = projectId ?? 'unsaved-photo-session';
  const history = usePersistedHistory(sessionId);

  const [projectName, setProjectName] = useState('Novo projeto');
  // RF-028/US-11: the project's own real asset (imported from the device or created by the
  // RAW converter) — falls back to the bundled demo photo only when there is no real asset yet.
  const [projectPhotoUri, setProjectPhotoUri] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSplit, setCompareSplit] = useState(50);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [zoom, setZoom] = useState(100);
  // US-08: a real (small) non-destructive layer stack — background + the color-adjustment
  // stack (already fully real) + vector paint layers. See @modules/photo-editor/layers.
  const [layers, setLayers] = useState<EditorLayer[]>(() => {
    const initialPaint = createPaintLayer('Pintura 1');
    return [
      { id: 'fundo', name: 'Fundo', kind: 'background', visible: true, opacity: 100, locked: true },
      {
        id: 'ajustes',
        name: 'Ajustes de cor',
        kind: 'adjustments',
        visible: true,
        opacity: 100,
        locked: false,
      },
      initialPaint,
    ];
  });
  const [selectedLayerId, setSelectedLayerId] = useState('fundo');
  const [brushColor, setBrushColor] = useState('#E5484D');
  const [brushSize, setBrushSize] = useState(8);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  // US-09: frame/light are drawn from the numeric Adjustments fields (undo-tracked like
  // everything else); their non-numeric bits (color, the picked second image) live here —
  // same deliberate split already used for paint layers/brushColor.
  const [frameColor, setFrameColor] = useState('#111111');
  const [frameGradientColor, setFrameGradientColor] = useState('#FFFFFF');
  const [lightEditMode, setLightEditMode] = useState(false);
  const [doubleExposureImage, setDoubleExposureImage] = useState<DoubleExposureImage | null>(null);

  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const photoUri = projectPhotoUri ?? DEMO_PHOTO_URI;

  // RF-057: a ref to the on-screen Canvas so ExportSheet can snapshot the real composited
  // result (adjustments + geometry + effects + paint layers, exactly as rendered on screen).
  const canvasRef = useCanvasRef();

  // RF-047/RF-063/RF-059: real GPU color-grading pipeline (see @modules/photo-editor/color)
  // instead of the flat tint overlay this screen used to fake it with.
  const skiaImage = useImage(photoUri);
  const doubleExposureSkImage = useImage(doubleExposureImage?.uri ?? null);
  const adjustmentsEffect = useMemo(() => Skia.RuntimeEffect.Make(ADJUSTMENTS_SKSL), []);
  const retroEffect = useMemo(() => Skia.RuntimeEffect.Make(RETRO_EFFECTS_SKSL), []);
  const uniforms = useMemo(
    () =>
      toFullUniforms(
        adjustments,
        {
          nitidez: adjustments.nitidez,
          raio: adjustments.raio,
          reducaoRuido: adjustments.reducaoRuido,
          luminancia: adjustments.luminancia,
        },
        {
          colorIndex: adjustments.corIndex >= 0 ? adjustments.corIndex : null,
          tolerancia: adjustments.corTolerancia,
          matiz: adjustments.corMatiz,
          saturacao: adjustments.corSaturacao,
          luminosidade: adjustments.corLuminosidade,
        },
        {
          master: { y1: adjustments.curveMasterY1, y2: adjustments.curveMasterY2 },
          r: { y1: adjustments.curveRY1, y2: adjustments.curveRY2 },
          g: { y1: adjustments.curveGY1, y2: adjustments.curveGY2 },
          b: { y1: adjustments.curveBY1, y2: adjustments.curveBY2 },
        }
      ),
    [adjustments]
  );
  const retroUniforms = useMemo(
    () =>
      toRetroUniforms(
        {
          aging: adjustments.retroAging,
          agingBlend: adjustments.retroAgingBlend,
          grain: adjustments.retroGrain,
          grainBlend: adjustments.retroGrainBlend,
          vignette: adjustments.retroVignette,
          vignetteBlend: adjustments.retroVignetteBlend,
        },
        {
          type: adjustments.overlayType,
          intensity: adjustments.overlayIntensity,
          opacity: adjustments.overlayOpacity,
        },
        PHOTO_WIDTH,
        PHOTO_HEIGHT
      ),
    [adjustments]
  );
  const histogram = useImageHistogram(skiaImage);
  const liveHistogram = useMemo(() => histogram.compute(uniforms), [histogram, uniforms]);

  // US-05: rotation/mirror/perspective geometry — a separate transform stage applied
  // around the color-adjusted image, real Skia matrices (not a cosmetic overlay).
  const [perspectiveEditMode, setPerspectiveEditMode] = useState(false);
  const totalRotationDeg = adjustments.rotation90 + adjustments.fineRotation;
  const totalRotationRad = (totalRotationDeg * Math.PI) / 180;
  const perspectiveCorners = useMemo<[Point, Point, Point, Point]>(
    () => [
      { x: adjustments.perspX0 * PHOTO_WIDTH, y: adjustments.perspY0 * PHOTO_HEIGHT },
      { x: adjustments.perspX1 * PHOTO_WIDTH, y: adjustments.perspY1 * PHOTO_HEIGHT },
      { x: adjustments.perspX2 * PHOTO_WIDTH, y: adjustments.perspY2 * PHOTO_HEIGHT },
      { x: adjustments.perspX3 * PHOTO_WIDTH, y: adjustments.perspY3 * PHOTO_HEIGHT },
    ],
    [
      adjustments.perspX0,
      adjustments.perspY0,
      adjustments.perspX1,
      adjustments.perspY1,
      adjustments.perspX2,
      adjustments.perspY2,
      adjustments.perspX3,
      adjustments.perspY3,
    ]
  );
  const perspectiveActive = perspectiveCorners.some(
    (p, i) =>
      Math.abs(p.x - [0, PHOTO_WIDTH, PHOTO_WIDTH, 0][i]) > 0.5 ||
      Math.abs(p.y - [0, 0, PHOTO_HEIGHT, PHOTO_HEIGHT][i]) > 0.5
  );
  // RF-048: maps the marked (distorted) quad onto the full canvas rect. Applied as the
  // Group's own render matrix — Skia rasterizes shader-filled geometry under a projective
  // matrix with true per-pixel perspective correction, unlike a triangle-mesh/UV
  // approximation (react-native-skia's Vertices textures didn't warp reliably here).
  const perspectiveMatrix = useMemo(
    () =>
      perspectiveActive
        ? computeHomography(perspectiveCorners, [
            { x: 0, y: 0 },
            { x: PHOTO_WIDTH, y: 0 },
            { x: PHOTO_WIDTH, y: PHOTO_HEIGHT },
            { x: 0, y: PHOTO_HEIGHT },
          ])
        : null,
    [perspectiveActive, perspectiveCorners]
  );
  const flipActive = adjustments.flipH > 0 || adjustments.flipV > 0;
  const adjustmentsLayerVisible = layers.find((l) => l.id === 'ajustes')?.visible ?? true;
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const paintModeActive =
    activeTool === 'camadas' && selectedLayer?.kind === 'paint' && !selectedLayer.locked;

  useEffect(() => {
    if (!projectId) return;
    const { getProject } = createProjectsModule();
    getProject
      .execute(projectId)
      .then((project) => {
        if (!project) return;
        setProjectName(project.name);
        const asset = project.assets[0];
        if (asset) setProjectPhotoUri(asset.workingUri || asset.originalUri);
      })
      .catch((error) => errorLogger.log(error, 'PhotoEditorScreen.getProject'));
  }, [projectId]);

  // RF-027: once the persisted log loads, replay it so reopening the project shows the
  // same adjustments that were last applied — undo/redo genuinely survives close/reopen.
  useEffect(() => {
    if (!history.ready) return;
    setAdjustments(history.reconstructState(DEFAULT_ADJUSTMENTS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.ready]);

  const commitAdjustment = useCallback(
    (field: string, value: number, previousValue: number) => {
      if (value === previousValue) return;
      setAdjustments((s) => ({ ...s, [field]: value }));
      history.push(field, previousValue, value);
    },
    [history]
  );

  const handleUndo = useCallback(() => {
    const op = history.undo();
    if (op && op.type in DEFAULT_ADJUSTMENTS) {
      setAdjustments((s) => ({ ...s, [op.type]: op.params.from as number }));
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const op = history.redo();
    if (op && op.type in DEFAULT_ADJUSTMENTS) {
      setAdjustments((s) => ({ ...s, [op.type]: op.params.to as number }));
    }
  }, [history]);

  const applyExifOrientation = useCallback(async () => {
    try {
      const response = await fetch(photoUri);
      const buffer = await response.arrayBuffer();
      const orientation = readExifOrientation(new Uint8Array(buffer));
      const transform = orientationToTransform(orientation);
      commitAdjustment('rotation90', transform.rotate, adjustments.rotation90);
      commitAdjustment('flipH', transform.flipH ? 1 : 0, adjustments.flipH);
      commitAdjustment('flipV', transform.flipV ? 1 : 0, adjustments.flipV);
    } catch (error) {
      errorLogger.log(error, 'PhotoEditorScreen.applyExifOrientation');
    }
  }, [photoUri, commitAdjustment, adjustments.rotation90, adjustments.flipH, adjustments.flipV]);

  const toggleTool = (tool: Exclude<Tool, null>) =>
    setActiveTool((prev) => (prev === tool ? null : tool));

  const onCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    setCanvasWidth(e.nativeEvent.layout.width);
  }, []);

  const updateSplitFromX = useCallback(
    (x: number) => {
      if (canvasWidth <= 0) return;
      const pct = (x / canvasWidth) * 100;
      setCompareSplit(Math.max(2, Math.min(98, pct)));
    },
    [canvasWidth]
  );

  const compareDrag = Gesture.Pan().onUpdate((e) => {
    runOnJS(updateSplitFromX)(e.x);
  });

  // RF-033: real digital painting — points are captured as they come in (works the same
  // for a finger or a stylus, since gesture-handler reports both as pointer events) and
  // committed as one vector stroke on release, appended to the active paint layer only.
  const appendStrokePoint = useCallback((x: number, y: number) => {
    setCurrentStroke((pts) => [...pts, { x, y }]);
  }, []);

  const commitStroke = useCallback(() => {
    setCurrentStroke((pts) => {
      if (pts.length > 1) {
        const path = pointsToPath(pts);
        setLayers((prev) =>
          prev.map((l) =>
            l.id === selectedLayerId
              ? {
                  ...l,
                  strokes: [
                    ...(l.strokes ?? []),
                    {
                      id: createStrokeId(),
                      path,
                      color: brushColor,
                      width: brushSize,
                      opacity: 1,
                    },
                  ],
                }
              : l
          )
        );
      }
      return [];
    });
  }, [selectedLayerId, brushColor, brushSize]);

  const paintGesture = Gesture.Pan()
    .onBegin((e) => {
      runOnJS(appendStrokePoint)(e.x, e.y);
    })
    .onUpdate((e) => {
      runOnJS(appendStrokePoint)(e.x, e.y);
    })
    .onEnd(() => {
      runOnJS(commitStroke)();
    });

  const setPerspCorner = useCallback((index: 0 | 1 | 2 | 3, nx: number, ny: number) => {
    setAdjustments((s) => ({ ...s, [`perspX${index}`]: nx, [`perspY${index}`]: ny }));
  }, []);

  const commitPerspCorner = useCallback(
    (index: 0 | 1 | 2 | 3, nx: number, ny: number, fromNx: number, fromNy: number) => {
      commitAdjustment(`perspX${index}`, nx, fromNx);
      commitAdjustment(`perspY${index}`, ny, fromNy);
    },
    [commitAdjustment]
  );

  const setLightPosition = useCallback((nx: number, ny: number) => {
    setAdjustments((s) => ({ ...s, lightX: nx, lightY: ny }));
  }, []);

  const commitLightPosition = useCallback(
    (nx: number, ny: number, fromNx: number, fromNy: number) => {
      commitAdjustment('lightX', nx, fromNx);
      commitAdjustment('lightY', ny, fromNy);
    },
    [commitAdjustment]
  );

  // US-09: chains the retro/overlay-texture shader (RF-041/028) right after the
  // color-adjustments one — Skia composes nested <Shader> nodes into a single GPU pass.
  const renderPhotoLayer = (
    flipH: boolean,
    flipV: boolean,
    opacity: number,
    key: string,
    includeDoubleExposure = false
  ) => (
    <Group
      key={key}
      transform={[{ scaleX: flipH ? -1 : 1 }, { scaleY: flipV ? -1 : 1 }]}
      origin={{ x: PHOTO_WIDTH / 2, y: PHOTO_HEIGHT / 2 }}
      opacity={opacity}
    >
      <Group matrix={perspectiveMatrix ?? undefined}>
        <Fill>
          <Shader source={retroEffect as NonNullable<typeof retroEffect>} uniforms={retroUniforms}>
            {/* US-08: hiding the "Ajustes de cor" layer genuinely shows the untouched photo. */}
            {adjustmentsLayerVisible ? (
              <Shader
                source={adjustmentsEffect as NonNullable<typeof adjustmentsEffect>}
                uniforms={uniforms}
              >
                <ImageShader
                  image={skiaImage}
                  fit="cover"
                  rect={{ x: 0, y: 0, width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
                />
              </Shader>
            ) : (
              <ImageShader
                image={skiaImage}
                fit="cover"
                rect={{ x: 0, y: 0, width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
              />
            )}
          </Shader>
        </Fill>
        {/* RF-075: a real second image, GPU-blended over the first with an adjustable mode/opacity. */}
        {includeDoubleExposure && doubleExposureSkImage && (
          <Group
            blendMode={blendModeAt(adjustments.doubleExposureBlend)}
            opacity={adjustments.doubleExposureOpacity / 100}
          >
            <Fill>
              <ImageShader
                image={doubleExposureSkImage}
                fit="cover"
                rect={{ x: 0, y: 0, width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
              />
            </Fill>
          </Group>
        )}
      </Group>
    </Group>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.navigate('Projects')} hitSlop={8}>
          <Icon name="chevronLeft" size={20} />
        </Pressable>
        <Text style={styles.fileName} numberOfLines={1}>
          {projectName} {history.canUndo && <Text style={styles.unsavedDot}>●</Text>}
        </Text>
        <Pressable onPress={() => setCompareMode((c) => !c)} hitSlop={6}>
          <Icon name="compare" size={18} color={compareMode ? colors.acento : colors.icone} />
        </Pressable>
        <Pressable onPress={handleUndo} disabled={!history.canUndo} hitSlop={6}>
          <Icon name="undo" size={18} color={history.canUndo ? colors.icone : colors.linha} />
        </Pressable>
        <Pressable onPress={handleRedo} disabled={!history.canRedo} hitSlop={6}>
          <Icon name="redo" size={18} color={history.canRedo ? colors.icone : colors.linha} />
        </Pressable>
        <Pressable style={styles.exportButton} onPress={() => setExportOpen(true)}>
          <Text style={styles.exportButtonText}>EXPORTAR</Text>
        </Pressable>
      </View>

      <View style={styles.techStrip}>
        {/* TODO: pull real dimensions / color space / bit depth / RAM usage. */}
        <Text style={styles.techText}>6000 × 4000 · Adobe RGB · 14 bits</Text>
        <Text style={styles.techText}>RAM 412 MB</Text>
      </View>

      <View style={styles.canvasArea}>
        <View style={styles.canvasCenter} onLayout={onCanvasLayout}>
          <View style={styles.photo}>
            {skiaImage && adjustmentsEffect ? (
              <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
                <Group
                  transform={[{ rotate: totalRotationRad }]}
                  origin={{ x: PHOTO_WIDTH / 2, y: PHOTO_HEIGHT / 2 }}
                >
                  {renderPhotoLayer(false, false, 1, 'base', true)}
                  {flipActive &&
                    renderPhotoLayer(
                      adjustments.flipH > 0,
                      adjustments.flipV > 0,
                      adjustments.mirrorOpacity / 100,
                      'mirror'
                    )}
                </Group>
                {/* RF-068: positioned in canvas space, like the paint layers below — it stays
                    where the user placed it regardless of the photo's own rotation. */}
                {adjustments.lightIntensity > 0 && (
                  <LightEffectOverlay
                    type={adjustments.lightType}
                    x={adjustments.lightX * PHOTO_WIDTH}
                    y={adjustments.lightY * PHOTO_HEIGHT}
                    intensity={adjustments.lightIntensity}
                    width={PHOTO_WIDTH}
                    height={PHOTO_HEIGHT}
                  />
                )}
                {/* US-08: paint layers live outside the photo's own rotate/flip group —
                    strokes stay put in canvas space, matching where they were drawn. */}
                {layers
                  .filter((l) => l.kind === 'paint' && l.visible)
                  .map((l) => (
                    <Group key={l.id} opacity={l.opacity / 100}>
                      {(l.strokes ?? []).map((s) => (
                        <Path
                          key={s.id}
                          path={s.path}
                          style="stroke"
                          strokeWidth={s.width}
                          strokeCap="round"
                          strokeJoin="round"
                          color={s.color}
                          opacity={s.opacity}
                        />
                      ))}
                    </Group>
                  ))}
                {currentStroke.length > 1 && (
                  <Path
                    path={pointsToPath(currentStroke)}
                    style="stroke"
                    strokeWidth={brushSize}
                    strokeCap="round"
                    strokeJoin="round"
                    color={brushColor}
                  />
                )}
                {/* RF-060: drawn last so the frame sits on top of the finished piece. */}
                {adjustments.frameStyle > 0 && (
                  <FrameOverlay
                    style={adjustments.frameStyle}
                    thickness={adjustments.frameThickness}
                    radius={adjustments.frameRadius}
                    color={frameColor}
                    gradientColor={frameGradientColor}
                    width={PHOTO_WIDTH}
                    height={PHOTO_HEIGHT}
                  />
                )}
              </Canvas>
            ) : (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            )}
            {perspectiveEditMode && (
              <PerspectiveHandles
                corners={perspectiveCorners}
                width={PHOTO_WIDTH}
                height={PHOTO_HEIGHT}
                onChangeCorner={setPerspCorner}
                onCommitCorner={commitPerspCorner}
              />
            )}
            {lightEditMode && (
              <LightPositionHandle
                x={adjustments.lightX * PHOTO_WIDTH}
                y={adjustments.lightY * PHOTO_HEIGHT}
                width={PHOTO_WIDTH}
                height={PHOTO_HEIGHT}
                onChange={setLightPosition}
                onCommitValue={commitLightPosition}
              />
            )}
            {paintModeActive && (
              <GestureDetector gesture={paintGesture}>
                <View style={StyleSheet.absoluteFill} />
              </GestureDetector>
            )}
          </View>
          {paintModeActive && (
            <View style={styles.brushBar}>
              {BRUSH_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setBrushColor(c)}
                  style={[
                    styles.brushSwatch,
                    { backgroundColor: c },
                    brushColor === c && styles.brushSwatchActive,
                  ]}
                />
              ))}
              <Pressable onPress={() => setBrushSize((s) => Math.max(2, s - 2))} hitSlop={6}>
                <Icon name="minus" size={14} color={colors.texto} />
              </Pressable>
              <Text style={styles.brushSizeText}>{brushSize}px</Text>
              <Pressable onPress={() => setBrushSize((s) => Math.min(40, s + 2))} hitSlop={6}>
                <Icon name="plus" size={14} color={colors.texto} />
              </Pressable>
            </View>
          )}

          {compareMode && canvasWidth > 0 && (
            <View style={StyleSheet.absoluteFill}>
              <View style={[styles.compareOriginalWrap, { width: `${compareSplit}%` }]}>
                <Image source={{ uri: photoUri }} style={[styles.photo, { width: canvasWidth }]} />
              </View>
              <GestureDetector gesture={compareDrag}>
                <View style={[styles.compareHandle, { left: `${compareSplit}%` }]}>
                  <View style={styles.compareHandleGrip}>
                    <Icon name="compare" size={14} color={colors.preto} />
                  </View>
                </View>
              </GestureDetector>
              <View style={styles.compareLabelLeft}>
                <Text style={styles.compareLabelText}>ORIGINAL</Text>
              </View>
              <View style={styles.compareLabelRight}>
                <Text style={styles.compareLabelText}>EDITADA</Text>
              </View>
            </View>
          )}
        </View>

        {activeTool === 'camadas' && (
          <LayersPanel
            layers={layers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onToggleVisibility={(id) =>
              setLayers((prev) =>
                prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
              )
            }
            onOpacityChange={(id, value) =>
              setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, opacity: value } : l)))
            }
            onAdd={() => {
              const layer = createPaintLayer(
                `Pintura ${layers.filter((l) => l.kind === 'paint').length + 1}`
              );
              setLayers((prev) => [...prev, layer]);
              setSelectedLayerId(layer.id);
            }}
            onDuplicate={(id) =>
              setLayers((prev) => {
                const source = prev.find((l) => l.id === id);
                if (!source) return prev;
                const copy = duplicateLayer(source);
                setSelectedLayerId(copy.id);
                return [...prev, copy];
              })
            }
            onMergeVisible={() =>
              setLayers((prev) => {
                const merged = mergeVisiblePaintLayers(prev);
                if (!merged.some((l) => l.id === selectedLayerId)) {
                  const survivor = merged.find((l) => l.kind === 'paint');
                  if (survivor) setSelectedLayerId(survivor.id);
                }
                return merged;
              })
            }
            onDelete={(id) =>
              setLayers((prev) => {
                const next = prev.filter((l) => l.id !== id);
                if (selectedLayerId === id) setSelectedLayerId('fundo');
                return next;
              })
            }
          />
        )}

        <View style={styles.zoomBar}>
          <Pressable onPress={() => setZoom((z) => Math.max(25, z - 25))} hitSlop={6}>
            <Icon name="minus" size={14} />
          </Pressable>
          <Text style={styles.zoomText}>{zoom}%</Text>
          <Pressable onPress={() => setZoom((z) => Math.min(400, z + 25))} hitSlop={6}>
            <Icon name="plus" size={14} />
          </Pressable>
        </View>
      </View>

      {activeTool && activeTool !== 'camadas' && (
        <View style={styles.toolDrawer}>
          <View style={styles.drawerHandleRow}>
            <View style={styles.drawerHandle} />
          </View>
          <ScrollView style={{ flex: 1 }}>
            {activeTool === 'ajustes' && (
              <AdjustDrawer
                adjustments={adjustments}
                setField={(field, v) => setAdjustments((s) => ({ ...s, [field]: v }))}
                onCommit={commitAdjustment}
                histogram={liveHistogram}
                skiaImage={skiaImage}
                adjustmentsEffect={adjustmentsEffect}
                uniforms={uniforms}
              />
            )}
            {activeTool === 'geometria' && (
              <GeometryDrawer
                adjustments={adjustments}
                setField={(field, v) => setAdjustments((s) => ({ ...s, [field]: v }))}
                onCommit={commitAdjustment}
                perspectiveEditMode={perspectiveEditMode}
                onTogglePerspectiveEditMode={() => setPerspectiveEditMode((v) => !v)}
                onApplyExif={applyExifOrientation}
              />
            )}
            {activeTool === 'mascaras' && <MasksDrawer />}
            {activeTool === 'retoque' && <RetouchDrawer />}
            {activeTool === 'efeitos' && (
              <EffectsDrawer
                adjustments={adjustments}
                setField={(field, v) => setAdjustments((s) => ({ ...s, [field]: v }))}
                onCommit={commitAdjustment}
                frameColor={frameColor}
                onFrameColorChange={setFrameColor}
                frameGradientColor={frameGradientColor}
                onFrameGradientColorChange={setFrameGradientColor}
                lightEditMode={lightEditMode}
                onToggleLightEditMode={() => setLightEditMode((v) => !v)}
                doubleExposureImage={doubleExposureImage}
                onPickDoubleExposureImage={setDoubleExposureImage}
                onClearDoubleExposureImage={() => setDoubleExposureImage(null)}
                currentProjectId={projectId}
              />
            )}
            {activeTool === 'elementos' && <ElementsDrawer />}
            {activeTool === 'ia' && <AIDrawer />}
            {activeTool === 'presets' && <PresetsDrawer />}
          </ScrollView>
        </View>
      )}

      <View style={styles.bottomToolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TOOLBAR.map(({ id, icon, label }) => {
            const isActive = activeTool === id;
            return (
              <Pressable
                key={id}
                style={[styles.toolbarItem, isActive && styles.toolbarItemActive]}
                onPress={() => toggleTool(id)}
              >
                <Icon name={icon} size={22} color={isActive ? colors.acento : colors.icone} />
                <Text style={[styles.toolbarLabel, isActive && styles.toolbarLabelActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {exportOpen && (
        <ExportSheet
          onClose={() => setExportOpen(false)}
          mediaKind="photo"
          getSourceImage={() => canvasRef.current?.makeImageSnapshot() ?? null}
        />
      )}
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
    elevation: 4,
  },
  fileName: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  unsavedDot: {
    color: colors.perigo,
  },
  exportButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.acento,
  },
  exportButtonText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#0D2036',
  },
  techStrip: {
    height: 28,
    backgroundColor: colors.faixa,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  techText: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  canvasArea: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  canvasCenter: {
    position: 'relative',
    maxWidth: '100%',
  },
  photo: {
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
  },
  compareOriginalWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  compareHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareHandleGrip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareLabelLeft: {
    position: 'absolute',
    top: 6,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  compareLabelRight: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  compareLabelText: {
    fontSize: 10,
    color: colors.branco,
  },
  zoomBar: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(37,37,37,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  zoomText: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto,
    width: 36,
    textAlign: 'center',
  },
  toolDrawer: {
    height: '45%',
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  drawerHandleRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  drawerHandle: {
    width: 32,
    height: 3,
    backgroundColor: colors.linha,
  },
  bottomToolbar: {
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  toolbarItem: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toolbarItemActive: {
    backgroundColor: colors.canvas,
  },
  toolbarLabel: {
    fontSize: 10,
    color: colors.texto2,
  },
  toolbarLabelActive: {
    color: colors.acento,
  },
  brushBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(37,37,37,0.92)',
    borderWidth: 1,
    borderColor: colors.linha,
  },
  brushSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  brushSwatchActive: {
    borderColor: colors.acento,
    borderWidth: 2,
  },
  brushSizeText: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto,
    width: 32,
    textAlign: 'center',
  },
});
