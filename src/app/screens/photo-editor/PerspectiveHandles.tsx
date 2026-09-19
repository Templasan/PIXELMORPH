import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors } from '@core/theme';
import type { Point } from '@modules/photo-editor/geometry';

interface CornerDotProps {
  point: Point; // canvas pixels
  width: number;
  height: number;
  onChange: (nx: number, ny: number) => void;
  onCommitValue: (nx: number, ny: number, fromNx: number, fromNy: number) => void;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** One draggable perspective corner (RF-048) — reports back normalized 0..1 coordinates. */
function CornerDot({ point, width, height, onChange, onCommitValue }: CornerDotProps) {
  const startNx = useRef(point.x / width);
  const startNy = useRef(point.y / height);
  const latestNx = useRef(point.x / width);
  const latestNy = useRef(point.y / height);

  const updateFromDelta = useCallback(
    (dx: number, dy: number) => {
      const nx = clamp01(startNx.current + dx / width);
      const ny = clamp01(startNy.current + dy / height);
      latestNx.current = nx;
      latestNy.current = ny;
      onChange(nx, ny);
    },
    [width, height, onChange]
  );

  const commit = useCallback(() => {
    onCommitValue(latestNx.current, latestNy.current, startNx.current, startNy.current);
  }, [onCommitValue]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startNx.current = point.x / width;
      startNy.current = point.y / height;
    })
    .onUpdate((e) => {
      runOnJS(updateFromDelta)(e.translationX, e.translationY);
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{
          position: 'absolute',
          left: point.x - 16,
          top: point.y - 16,
          width: 32,
          height: 32,
        }}
      />
    </GestureDetector>
  );
}

interface PerspectiveHandlesProps {
  corners: [Point, Point, Point, Point]; // canvas pixels
  width: number;
  height: number;
  onChangeCorner: (index: 0 | 1 | 2 | 3, nx: number, ny: number) => void;
  onCommitCorner: (
    index: 0 | 1 | 2 | 3,
    nx: number,
    ny: number,
    fromNx: number,
    fromNy: number
  ) => void;
}

/** RF-048: the four draggable reference points overlaid on the canvas for perspective correction. */
export function PerspectiveHandles({
  corners,
  width,
  height,
  onChangeCorner,
  onCommitCorner,
}: PerspectiveHandlesProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Line
          x1={corners[0].x}
          y1={corners[0].y}
          x2={corners[1].x}
          y2={corners[1].y}
          stroke={colors.acento}
          strokeWidth={2}
        />
        <Line
          x1={corners[1].x}
          y1={corners[1].y}
          x2={corners[2].x}
          y2={corners[2].y}
          stroke={colors.acento}
          strokeWidth={2}
        />
        <Line
          x1={corners[2].x}
          y1={corners[2].y}
          x2={corners[3].x}
          y2={corners[3].y}
          stroke={colors.acento}
          strokeWidth={2}
        />
        <Line
          x1={corners[3].x}
          y1={corners[3].y}
          x2={corners[0].x}
          y2={corners[0].y}
          stroke={colors.acento}
          strokeWidth={2}
        />
        {corners.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={7} fill={colors.acento} />
        ))}
      </Svg>
      {corners.map((corner, i) => (
        <CornerDot
          key={i}
          point={corner}
          width={width}
          height={height}
          onChange={(nx, ny) => onChangeCorner(i as 0 | 1 | 2 | 3, nx, ny)}
          onCommitValue={(nx, ny, fromNx, fromNy) =>
            onCommitCorner(i as 0 | 1 | 2 | 3, nx, ny, fromNx, fromNy)
          }
        />
      ))}
    </View>
  );
}
