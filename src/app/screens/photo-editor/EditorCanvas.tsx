import { memo } from 'react';
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
import { arrowPath, type BrushShape, type EditorLayer } from '@modules/photo-editor/layers';
import type { Point } from '@modules/photo-editor/geometry';
import { FrameOverlay } from './FrameOverlay';
import { LightEffectOverlay } from './LightEffectOverlay';
import { PaintLayers, CurrentStroke } from './PaintLayers';
import { PhotoLayer } from './PhotoLayer';
import { PHOTO_WIDTH, PHOTO_HEIGHT } from './dims';
import type { Adjustments } from '../PhotoEditorScreen';

type PhotoLayerProps = Parameters<typeof PhotoLayer>[0];

interface Props {
  canvasRef: ReturnType<typeof useCanvasRef>;
  skiaImage: SkImage;
  adjustmentsEffect: SkRuntimeEffect;
  retroEffect: SkRuntimeEffect | null;
  uniforms: PhotoLayerProps['uniforms'];
  retroUniforms: PhotoLayerProps['retroUniforms'];
  totalRotationRad: number;
  parallaxOffset: { x: number; y: number };
  perspectiveMatrix: PhotoLayerProps['matrix'] | null;
  flipActive: boolean;
  adjustmentsLayerVisible: boolean;
  doubleExposureSkImage: SkImage | null;
  overlaySkImage: SkImage | null;
  adjustments: Adjustments;
  layers: EditorLayer[];
  currentStroke: Point[];
  brushSize: number;
  brushShape: BrushShape;
  brushColor: string;
  brushOpacity: number;
  frameColor: string;
  frameGradientColor: string;
}

/**
 * The photo editor's Skia canvas (photo, adjustments, effects, paint/text/shape layers, frame).
 * Memoized: it re-renders only when something it draws changes, not when the screen re-renders
 * for UI state such as opening a drawer — that used to rebuild the whole Skia tree.
 */
export const EditorCanvas = memo(function EditorCanvas({
  canvasRef,
  skiaImage,
  adjustmentsEffect,
  retroEffect,
  uniforms,
  retroUniforms,
  totalRotationRad,
  parallaxOffset,
  perspectiveMatrix,
  flipActive,
  adjustmentsLayerVisible,
  doubleExposureSkImage,
  overlaySkImage,
  adjustments,
  layers,
  currentStroke,
  brushSize,
  brushShape,
  brushColor,
  brushOpacity,
  frameColor,
  frameGradientColor,
}: Props) {
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
