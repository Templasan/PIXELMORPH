import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '@core/theme';
import type { Point } from '@modules/photo-editor';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp01(v: number): number {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

interface CornerDotProps {
  point: Point; // canvas pixels
  width: number;
  height: number;
  xSV: SharedValue<number>;
  ySV: SharedValue<number>;
  onChange: (nx: number, ny: number) => void;
  onCommitValue: (nx: number, ny: number, fromNx: number, fromNy: number) => void;
}

/**
 * One draggable perspective corner (RF-048) — `xSV`/`ySV` (owned by the parent, shared with
 * the connecting lines/dot) are updated directly in the pan worklet, so the quad tracks the
 * finger on the UI thread with no bridge hop. The (expensive) `onChange` that recomputes the
 * homography and re-renders the warped canvas is throttled to every 3rd touch-move — same
 * fix as the Slider and Curvas handles.
 */
function CornerDot({ point, width, height, xSV, ySV, onChange, onCommitValue }: CornerDotProps) {
  const startNx = useSharedValue(point.x / width);
  const startNy = useSharedValue(point.y / height);
  const isDragging = useSharedValue(false);
  const frameCounter = useSharedValue(0);

  useEffect(() => {
    if (!isDragging.value) {
      xSV.value = point.x;
      ySV.value = point.y;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point.x, point.y]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startNx.value = xSV.value / width;
      startNy.value = ySV.value / height;
      isDragging.value = true;
      frameCounter.value = 0;
    })
    .onUpdate((e) => {
      const nx = clamp01(startNx.value + e.translationX / width);
      const ny = clamp01(startNy.value + e.translationY / height);
      xSV.value = nx * width;
      ySV.value = ny * height;
      frameCounter.value += 1;
      if (frameCounter.value % 3 === 0) {
        runOnJS(onChange)(nx, ny);
      }
    })
    .onEnd(() => {
      isDragging.value = false;
      const nx = xSV.value / width;
      const ny = ySV.value / height;
      runOnJS(onChange)(nx, ny);
      runOnJS(onCommitValue)(nx, ny, startNx.value, startNy.value);
    });

  const style = useAnimatedStyle(() => ({
    left: xSV.value - 16,
    top: ySV.value - 16,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.handle, style]} />
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
  const x0 = useSharedValue(corners[0].x);
  const y0 = useSharedValue(corners[0].y);
  const x1 = useSharedValue(corners[1].x);
  const y1 = useSharedValue(corners[1].y);
  const x2 = useSharedValue(corners[2].x);
  const y2 = useSharedValue(corners[2].y);
  const x3 = useSharedValue(corners[3].x);
  const y3 = useSharedValue(corners[3].y);
  const xs = [x0, x1, x2, x3];
  const ys = [y0, y1, y2, y3];

  const line01 = useAnimatedProps(() => ({
    x1: x0.value,
    y1: y0.value,
    x2: x1.value,
    y2: y1.value,
  }));
  const line12 = useAnimatedProps(() => ({
    x1: x1.value,
    y1: y1.value,
    x2: x2.value,
    y2: y2.value,
  }));
  const line23 = useAnimatedProps(() => ({
    x1: x2.value,
    y1: y2.value,
    x2: x3.value,
    y2: y3.value,
  }));
  const line30 = useAnimatedProps(() => ({
    x1: x3.value,
    y1: y3.value,
    x2: x0.value,
    y2: y0.value,
  }));
  const circle0 = useAnimatedProps(() => ({ cx: x0.value, cy: y0.value }));
  const circle1 = useAnimatedProps(() => ({ cx: x1.value, cy: y1.value }));
  const circle2 = useAnimatedProps(() => ({ cx: x2.value, cy: y2.value }));
  const circle3 = useAnimatedProps(() => ({ cx: x3.value, cy: y3.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <AnimatedLine animatedProps={line01} stroke={colors.acento} strokeWidth={2} />
        <AnimatedLine animatedProps={line12} stroke={colors.acento} strokeWidth={2} />
        <AnimatedLine animatedProps={line23} stroke={colors.acento} strokeWidth={2} />
        <AnimatedLine animatedProps={line30} stroke={colors.acento} strokeWidth={2} />
        <AnimatedCircle animatedProps={circle0} r={7} fill={colors.acento} />
        <AnimatedCircle animatedProps={circle1} r={7} fill={colors.acento} />
        <AnimatedCircle animatedProps={circle2} r={7} fill={colors.acento} />
        <AnimatedCircle animatedProps={circle3} r={7} fill={colors.acento} />
      </Svg>
      {corners.map((corner, i) => (
        <CornerDot
          key={i}
          point={corner}
          width={width}
          height={height}
          xSV={xs[i]}
          ySV={ys[i]}
          onChange={(nx, ny) => onChangeCorner(i as 0 | 1 | 2 | 3, nx, ny)}
          onCommitValue={(nx, ny, fromNx, fromNy) =>
            onCommitCorner(i as 0 | 1 | 2 | 3, nx, ny, fromNx, fromNy)
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    width: 32,
    height: 32,
  },
});
