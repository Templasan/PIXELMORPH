import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors } from '@core/theme';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

interface LightPositionHandleProps {
  x: number; // canvas pixels
  y: number;
  width: number;
  height: number;
  onChange: (nx: number, ny: number) => void;
  onCommitValue: (nx: number, ny: number, fromNx: number, fromNy: number) => void;
}

/** RF-068: a single draggable point for manually positioning the lighting effect. */
export function LightPositionHandle({
  x,
  y,
  width,
  height,
  onChange,
  onCommitValue,
}: LightPositionHandleProps) {
  const startNx = useRef(x / width);
  const startNy = useRef(y / height);
  const latestNx = useRef(x / width);
  const latestNy = useRef(y / height);

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
      startNx.current = x / width;
      startNy.current = y / height;
    })
    .onUpdate((e) => {
      runOnJS(updateFromDelta)(e.translationX, e.translationY);
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Line x1={x - 12} y1={y} x2={x + 12} y2={y} stroke={colors.acento} strokeWidth={2} />
        <Line x1={x} y1={y - 12} x2={x} y2={y + 12} stroke={colors.acento} strokeWidth={2} />
        <Circle cx={x} cy={y} r={10} stroke={colors.acento} strokeWidth={2} fill="none" />
      </Svg>
      <GestureDetector gesture={pan}>
        <View style={{ position: 'absolute', left: x - 18, top: y - 18, width: 36, height: 36 }} />
      </GestureDetector>
    </View>
  );
}
