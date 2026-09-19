import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors } from '@core/theme';
import { snapToGuides } from '@modules/photo-editor/geometry';

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
  /** RF-067: snaps to the canvas center lines and shows a guide while dragging. */
  guides?: boolean;
}

/** RF-068/RF-067: a single draggable point — optionally snaps to center guides while dragging. */
export function LightPositionHandle({
  x,
  y,
  width,
  height,
  onChange,
  onCommitValue,
  guides = false,
}: LightPositionHandleProps) {
  const startNx = useRef(x / width);
  const startNy = useRef(y / height);
  const latestNx = useRef(x / width);
  const latestNy = useRef(y / height);
  const [snap, setSnap] = useState({ snappedX: false, snappedY: false });

  const updateFromDelta = useCallback(
    (dx: number, dy: number) => {
      let nx = clamp01(startNx.current + dx / width);
      let ny = clamp01(startNy.current + dy / height);
      if (guides) {
        const snapped = snapToGuides(nx, ny);
        nx = snapped.x;
        ny = snapped.y;
        setSnap({ snappedX: snapped.snappedX, snappedY: snapped.snappedY });
      }
      latestNx.current = nx;
      latestNy.current = ny;
      onChange(nx, ny);
    },
    [width, height, onChange, guides]
  );

  const commit = useCallback(() => {
    onCommitValue(latestNx.current, latestNy.current, startNx.current, startNy.current);
    setSnap({ snappedX: false, snappedY: false });
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
        {guides && snap.snappedX && (
          <Line
            x1={width / 2}
            y1={0}
            x2={width / 2}
            y2={height}
            stroke={colors.perigo}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        )}
        {guides && snap.snappedY && (
          <Line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke={colors.perigo}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        )}
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
