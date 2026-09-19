import { RoundedRect, LinearGradient, Shadow } from '@shopify/react-native-skia';
import { frameRadiusPx, frameThicknessPx } from '@modules/photo-editor/effects';

interface FrameOverlayProps {
  style: number; // FRAME_STYLES index — 0 is "no frame", callers should skip rendering it
  thickness: number; // 0..100
  radius: number; // 0..100
  color: string;
  gradientColor: string;
  width: number;
  height: number;
}

/** RF-060: molduras e bordas — real Skia vector geometry, not a rasterized asset. */
export function FrameOverlay({
  style,
  thickness,
  radius,
  color,
  gradientColor,
  width,
  height,
}: FrameOverlayProps) {
  const shortSide = Math.min(width, height);
  const t = Math.max(1, frameThicknessPx(thickness, shortSide));
  const r = style === 2 ? frameRadiusPx(radius, t) : 0;
  const rectProps = { x: t / 2, y: t / 2, width: width - t, height: height - t, r };

  return (
    <RoundedRect {...rectProps} style="stroke" strokeWidth={t} color={color}>
      {style === 3 && <Shadow dx={0} dy={0} blur={t * 0.8} color="rgba(0,0,0,0.55)" />}
      {style === 4 && (
        <LinearGradient
          start={{ x: 0, y: 0 }}
          end={{ x: width, y: height }}
          colors={[color, gradientColor]}
        />
      )}
    </RoundedRect>
  );
}
