import { Circle, Group, RadialGradient } from '@shopify/react-native-skia';
import { lensReflectionSpots } from '@modules/photo-editor/effects';

interface LightEffectOverlayProps {
  type: number; // LIGHT_TYPES index: 0=flare, 1=brilho, 2=reflexo lenticular
  x: number; // canvas pixels
  y: number;
  intensity: number; // 0..100
  width: number;
  height: number;
}

/** RF-068: efeitos de iluminação — real radial-gradient light, screen-blended over the photo. */
export function LightEffectOverlay({
  type,
  x,
  y,
  intensity,
  width,
  height,
}: LightEffectOverlayProps) {
  const amount = intensity / 100;
  if (amount <= 0.0001) return null;

  const baseRadius = type === 1 ? Math.min(width, height) * 0.22 : Math.min(width, height) * 0.32;
  const center = { x: width / 2, y: height / 2 };

  return (
    <Group blendMode="screen">
      <Circle cx={x} cy={y} r={baseRadius * (0.5 + amount * 0.7)}>
        <RadialGradient
          c={{ x, y }}
          r={baseRadius * (0.5 + amount * 0.7)}
          colors={[`rgba(255,255,255,${0.85 * amount})`, 'rgba(255,255,255,0)']}
        />
      </Circle>
      {type === 2 &&
        lensReflectionSpots({ x, y }, center, 4).map((spot, i) => (
          <Circle key={i} cx={spot.x} cy={spot.y} r={spot.radius}>
            <RadialGradient
              c={{ x: spot.x, y: spot.y }}
              r={spot.radius}
              colors={[`rgba(255,255,255,${spot.opacity * amount})`, 'rgba(255,255,255,0)']}
            />
          </Circle>
        ))}
    </Group>
  );
}
