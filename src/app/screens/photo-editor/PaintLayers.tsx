import { memo } from 'react';
import { Group, Path } from '@shopify/react-native-skia';
import {
  brushTip,
  pointsToPath,
  type BrushShape,
  type EditorLayer,
  type Point,
} from '@modules/photo-editor';

// US-08: paint layers live outside the photo's rotate/flip group — strokes stay in canvas space.
export const PaintLayers = memo(function PaintLayers({ layers }: { layers: EditorLayer[] }) {
  return (
    <>
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
                strokeCap={brushTip(s.shape).cap}
                strokeJoin={brushTip(s.shape).join}
                color={s.color}
                opacity={s.opacity}
              />
            ))}
          </Group>
        ))}
    </>
  );
});

export const CurrentStroke = memo(function CurrentStroke(p: {
  points: Point[];
  width: number;
  shape: BrushShape;
  color: string;
  opacity: number;
}) {
  if (p.points.length <= 1) return null;
  return (
    <Path
      path={pointsToPath(p.points)}
      style="stroke"
      strokeWidth={p.width}
      strokeCap={brushTip(p.shape).cap}
      strokeJoin={brushTip(p.shape).join}
      color={p.color}
      opacity={p.opacity / 100}
    />
  );
});
