import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors } from '@core/theme';
import { snapToGuides, type SnapTargets } from '@modules/photo-editor';

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
  /** Extra normalized snap targets (other layers' centers/edges). */
  targets?: SnapTargets;
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
  targets,
}: LightPositionHandleProps) {
  const startNx = useRef(x / width);
  const startNy = useRef(y / height);
  const latestNx = useRef(x / width);
  const latestNy = useRef(y / height);
  const [snap, setSnap] = useState<{ gx: number | null; gy: number | null }>({
    gx: null,
    gy: null,
  });

  const updateFromDelta = useCallback(
    (dx: number, dy: number) => {
      let nx = clamp01(startNx.current + dx / width);
      let ny = clamp01(startNy.current + dy / height);
      if (guides) {
        const snapped = snapToGuides(nx, ny, 0.02, targets);
        nx = snapped.x;
        ny = snapped.y;
        setSnap({ gx: snapped.guideX, gy: snapped.guideY });
      }
      latestNx.current = nx;
      latestNy.current = ny;
      onChange(nx, ny);
    },
    [width, height, onChange, guides, targets]
  );

  const commit = useCallback(() => {
    onCommitValue(latestNx.current, latestNy.current, startNx.current, startNy.current);
    setSnap({ gx: null, gy: null });
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
        {guides && snap.gx !== null && (
          <Line
            x1={snap.gx! * width}
            y1={0}
            x2={snap.gx! * width}
            y2={height}
            stroke={colors.perigo}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        )}
        {guides && snap.gy !== null && (
          <Line
            x1={0}
            y1={snap.gy! * height}
            x2={width}
            y2={snap.gy! * height}
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
