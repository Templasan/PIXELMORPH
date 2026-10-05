import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Rect,
  Text as SkiaText,
  matchFont,
  type SkImage,
  type SkRuntimeEffect,
  type useCanvasRef,
} from '@shopify/react-native-skia';
import { useStore } from '@core/state';
import { arrowPath, type PhotoEditorStore } from '@modules/photo-editor';
import {
  adjustmentUniforms,
  perspectiveMatrixOf,
  retroUniformsOf,
  totalRotationRadOf,
} from '@modules/photo-editor/domain/adjustments';
import { FrameOverlay } from './FrameOverlay';
import { LightEffectOverlay } from './LightEffectOverlay';
import { PaintLayers, CurrentStroke } from './PaintLayers';
import { PhotoLayer } from './PhotoLayer';
import { PHOTO_WIDTH, PHOTO_HEIGHT } from './dims';

interface Props {
  editor: PhotoEditorStore;
  canvasRef: ReturnType<typeof useCanvasRef>;
  skiaImage: SkImage;
  adjustmentsEffect: SkRuntimeEffect;
  retroEffect: SkRuntimeEffect | null;
  parallaxOffset: { x: number; y: number };
  doubleExposureSkImage: SkImage | null;
  overlaySkImage: SkImage | null;
  frameColor: string;
  frameGradientColor: string;
}

/**
 * The photo editor's Skia canvas (photo, adjustments, effects, paint/text/shape layers, frame).
 * It subscribes to the editor store itself, so a slider tick or a brush point re-renders the
 * canvas alone — not the screen, and opening a drawer does not touch the canvas at all.
 */
export const EditorCanvas = memo(function EditorCanvas({
  editor,
  canvasRef,
  skiaImage,
  adjustmentsEffect,
  retroEffect,
  parallaxOffset,
  doubleExposureSkImage,
  overlaySkImage,
  frameColor,
  frameGradientColor,
}: Props) {
  const adjustments = useStore(editor.store, (st) => st.adjustments);
  const layers = useStore(editor.store, (st) => st.layers);
  const currentStroke = useStore(editor.store, (st) => st.currentStroke);
  const {
    color: brushColor,
    size: brushSize,
    shape: brushShape,
    opacity: brushOpacity,
  } = useStore(editor.store, (st) => st.brush);

  const uniforms = useMemo(() => adjustmentUniforms(adjustments), [adjustments]);
  const retroUniforms = useMemo(
    () => retroUniformsOf(adjustments, PHOTO_WIDTH, PHOTO_HEIGHT),
    [adjustments]
  );
  const perspectiveMatrix = useMemo(
    () => perspectiveMatrixOf(adjustments, PHOTO_WIDTH, PHOTO_HEIGHT),
    [adjustments]
  );
  const totalRotationRad = totalRotationRadOf(adjustments);
  const flipActive = adjustments.flipH > 0 || adjustments.flipV > 0;
  const adjustmentsLayerVisible = layers.find((l) => l.id === 'ajustes')?.visible ?? true;

  return (
    <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
      <Group
        transform={[
          { rotate: totalRotationRad },
          ...(parallaxOffset.x !== 0 || parallaxOffset.y !== 0
            ? [{ translateX: parallaxOffset.x }, { translateY: parallaxOffset.y }]
            : []),
        ]}
        origin={{ x: PHOTO_WIDTH / 2, y: PHOTO_HEIGHT / 2 }}
      >
        <PhotoLayer
          key="base"
          flipH={false}
          flipV={false}
          opacity={1}
          includeOverlays={true}
          matrix={perspectiveMatrix ?? undefined}
          retroEffect={retroEffect as NonNullable<typeof retroEffect>}
          retroUniforms={retroUniforms}
          adjustmentsEffect={adjustmentsEffect}
          uniforms={uniforms}
          adjustmentsVisible={adjustmentsLayerVisible}
          image={skiaImage}
          doubleExposureImage={doubleExposureSkImage}
          doubleExposureBlend={adjustments.doubleExposureBlend}
          doubleExposureOpacity={adjustments.doubleExposureOpacity}
          overlayImage={overlaySkImage}
          overlayBlend={adjustments.overlayBlend}
          overlayIntensity={adjustments.overlayIntensity}
        />
        {flipActive && (
          <PhotoLayer
            key="mirror"
            flipH={adjustments.flipH > 0}
            flipV={adjustments.flipV > 0}
            opacity={adjustments.mirrorOpacity / 100}
            includeOverlays={false}
            matrix={perspectiveMatrix ?? undefined}
            retroEffect={retroEffect as NonNullable<typeof retroEffect>}
            retroUniforms={retroUniforms}
            adjustmentsEffect={adjustmentsEffect}
            uniforms={uniforms}
            adjustmentsVisible={adjustmentsLayerVisible}
            image={skiaImage}
            doubleExposureImage={doubleExposureSkImage}
            doubleExposureBlend={adjustments.doubleExposureBlend}
            doubleExposureOpacity={adjustments.doubleExposureOpacity}
            overlayImage={overlaySkImage}
            overlayBlend={adjustments.overlayBlend}
            overlayIntensity={adjustments.overlayIntensity}
          />
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
      <PaintLayers layers={layers} />
      <CurrentStroke
        points={currentStroke}
        width={brushSize}
        shape={brushShape}
        color={brushColor}
        opacity={brushOpacity}
      />
      {/* RF-008: real Skia text — a system font (via matchFont), color, optional
        drop shadow and stroke outline all draw for real, so they survive export. */}
      {layers
        .filter((l) => l.kind === 'text' && l.visible && l.text)
        .map((l) => {
          const t = l.text!;
          const font = matchFont({
            fontFamily: t.fontFamily,
            fontSize: t.fontSize,
            fontWeight: 'bold',
          });
          const textWidth = font.measureText(t.content).width;
          const px = t.x * PHOTO_WIDTH - textWidth / 2;
          const py = t.y * PHOTO_HEIGHT;
          return (
            <Group key={l.id} opacity={l.opacity / 100}>
              {t.shadow && (
                <SkiaText
                  text={t.content}
                  x={px + 2}
                  y={py + 2}
                  font={font}
                  color="rgba(0,0,0,0.5)"
                />
              )}
              {t.strokeWidth > 0 && (
                <SkiaText
                  text={t.content}
                  x={px}
                  y={py}
                  font={font}
                  color={t.strokeColor}
                  style="stroke"
                  strokeWidth={t.strokeWidth}
                />
              )}
              <SkiaText text={t.content} x={px} y={py} font={font} color={t.color} />
            </Group>
          );
        })}
      {/* RF-044: real vector shapes — same layer stack, same drag handle pattern. */}
      {layers
        .filter((l) => l.kind === 'shape' && l.visible && l.shape)
        .map((l) => {
          const s = l.shape!;
          const cx = s.x * PHOTO_WIDTH;
          const cy = s.y * PHOTO_HEIGHT;
          const r = s.size * PHOTO_WIDTH;
          return (
            <Group key={l.id} opacity={l.opacity / 100}>
              {s.kind === 'circle' && (
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  style="stroke"
                  strokeWidth={s.strokeWidth}
                  color={s.color}
                />
              )}
              {s.kind === 'rect' && (
                <Rect
                  x={cx - r}
                  y={cy - r}
                  width={r * 2}
                  height={r * 2}
                  style="stroke"
                  strokeWidth={s.strokeWidth}
                  color={s.color}
                />
              )}
              {s.kind === 'line' && (
                <Line
                  p1={{ x: cx - r, y: cy }}
                  p2={{ x: cx + r, y: cy }}
                  strokeWidth={s.strokeWidth}
                  color={s.color}
                />
              )}
              {s.kind === 'arrow' && (
                <Path
                  path={arrowPath(cx, cy, r)}
                  style="stroke"
                  strokeWidth={s.strokeWidth}
                  strokeCap="round"
                  strokeJoin="round"
                  color={s.color}
                />
              )}
            </Group>
          );
        })}
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
  );
});
