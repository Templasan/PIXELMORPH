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
import { Canvas, Fill, ImageShader, Shader, Skia, useImage } from '@shopify/react-native-skia';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, ExportSheet } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { usePersistedHistory } from '@core/history';
import { createProjectsModule } from '@modules/projects';
import { errorLogger } from '@core/reliability';
import { ADJUSTMENTS_SKSL, toFullUniforms, useImageHistogram } from '@modules/photo-editor/color';
import { AdjustDrawer } from './photo-editor/AdjustDrawer';
import { GeometryDrawer } from './photo-editor/GeometryDrawer';
import { MasksDrawer } from './photo-editor/MasksDrawer';
import { RetouchDrawer } from './photo-editor/RetouchDrawer';
import { EffectsDrawer } from './photo-editor/EffectsDrawer';
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

const PHOTO_URI =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=533&fit=crop&auto=format';
const PHOTO_WIDTH = 340;
const PHOTO_HEIGHT = 227;

interface Adjustments {
  // Básico (RF-047)
  temperatura: number;
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
  [key: string]: number;
}

const DEFAULT_ADJUSTMENTS: Adjustments = {
  temperatura: 0,
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
};

export default function PhotoEditorScreen({ navigation, route }: Props) {
  const projectId = route.params?.projectId;
  // Falls back to a fixed key so the spike/dev entry point (no project id) still gets
  // working undo/redo instead of crashing — RF-027 just won't survive across app restarts.
  const sessionId = projectId ?? 'unsaved-photo-session';
  const history = usePersistedHistory(sessionId);

  const [projectName, setProjectName] = useState('Novo projeto');
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSplit, setCompareSplit] = useState(50);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [layersVisible, setLayersVisible] = useState<Record<string, boolean>>({
    texto: true,
    pintura: true,
    efeitos: true,
    vinheta: true,
    granulado: true,
    mascara: true,
    ajustes: true,
    fundo: true,
  });
  const [groupExpanded, setGroupExpanded] = useState(true);
  const [layerOpacity, setLayerOpacity] = useState(100);

  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);

  // RF-047/RF-063/RF-059: real GPU color-grading pipeline (see @modules/photo-editor/color)
  // instead of the flat tint overlay this screen used to fake it with.
  const skiaImage = useImage(PHOTO_URI);
  const adjustmentsEffect = useMemo(() => Skia.RuntimeEffect.Make(ADJUSTMENTS_SKSL), []);
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
        }
      ),
    [adjustments]
  );
  const histogram = useImageHistogram(skiaImage);
  const liveHistogram = useMemo(() => histogram.compute(uniforms), [histogram, uniforms]);

  useEffect(() => {
    if (!projectId) return;
    const { getProject } = createProjectsModule();
    getProject
      .execute(projectId)
      .then((project) => {
        if (project) setProjectName(project.name);
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
              <Canvas style={StyleSheet.absoluteFill}>
                <Fill>
                  <Shader source={adjustmentsEffect} uniforms={uniforms}>
                    <ImageShader
                      image={skiaImage}
                      fit="cover"
                      rect={{ x: 0, y: 0, width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
                    />
                  </Shader>
                </Fill>
              </Canvas>
            ) : (
              <Image source={{ uri: PHOTO_URI }} style={styles.photo} />
            )}
          </View>

          {compareMode && canvasWidth > 0 && (
            <View style={StyleSheet.absoluteFill}>
              <View style={[styles.compareOriginalWrap, { width: `${compareSplit}%` }]}>
                <Image source={{ uri: PHOTO_URI }} style={[styles.photo, { width: canvasWidth }]} />
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
            visibility={layersVisible}
            onToggleVisibility={(key) =>
              setLayersVisible((prev) => ({ ...prev, [key]: !prev[key] }))
            }
            groupExpanded={groupExpanded}
            onToggleGroup={() => setGroupExpanded((g) => !g)}
            opacity={layerOpacity}
            onOpacityChange={setLayerOpacity}
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
            {activeTool === 'geometria' && <GeometryDrawer />}
            {activeTool === 'mascaras' && <MasksDrawer />}
            {activeTool === 'retoque' && <RetouchDrawer />}
            {activeTool === 'efeitos' && <EffectsDrawer />}
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

      {exportOpen && <ExportSheet onClose={() => setExportOpen(false)} />}
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
});
