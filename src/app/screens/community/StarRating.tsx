import Svg, { ClipPath, Defs, G, Polygon, Rect } from 'react-native-svg';
import { colors } from '@core/theme';

interface StarRatingProps {
  rating: number;
  size?: number;
  idPrefix?: string;
}

function starPoints(size: number): string {
  const c = size / 2;
  const r = size / 2;
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const outer = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const inner = outer + Math.PI / 5;
    pts.push(`${c + r * Math.cos(outer)},${c + r * Math.sin(outer)}`);
    pts.push(`${c + r * 0.4 * Math.cos(inner)},${c + r * 0.4 * Math.sin(inner)}`);
  }
  return pts.join(' ');
}

/** Five partially-filled stars, ported 1:1 from the prototype's clip-path SVG technique. */
export function StarRating({ rating, size = 13, idPrefix = 'sr' }: StarRatingProps) {
  const gap = 2;
  const total = size * 5 + gap * 4;
  const points = starPoints(size);

  return (
    <Svg width={total} height={size} viewBox={`0 0 ${total} ${size}`}>
      <Defs>
        {Array.from({ length: 5 }).map((_, i) => {
          const fill = Math.max(0, Math.min(1, rating - i));
          return (
            <ClipPath key={i} id={`${idPrefix}-${i}`}>
              <Rect x={0} y={0} width={size * fill} height={size} />
            </ClipPath>
          );
        })}
      </Defs>
      {Array.from({ length: 5 }).map((_, i) => (
        <G key={i} translateX={i * (size + gap)}>
          <Polygon points={points} fill="#2A2A2A" stroke={colors.linha} strokeWidth={0.5} />
          <Polygon points={points} fill={colors.acento} clipPath={`url(#${idPrefix}-${i})`} />
        </G>
      ))}
    </Svg>
  );
}
