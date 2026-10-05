import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, fontSize, monoFontFamily } from '../theme';
import { createEchoTracker, snapValue, toPct } from './sliderEcho';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  step?: number;
  /** Draws a center tick and treats 0 as the resting point (e.g. Temperatura, Matiz). */
  bipolar?: boolean;
  /** Overrides the track color, e.g. a blue-to-orange gradient stand-in for Temperatura. */
  trackColor?: string;
  /** Renders a two-stop gradient track (e.g. Temperatura: blue -> orange) instead of a fill bar. */
  gradientColors?: readonly [string, string];
  /** Prefixes positive values with "+" (used by bipolar adjustment sliders). */
  showSign?: boolean;
  labelWidth?: number;
  onChange: (value: number) => void;
  /**
   * Fires once when a drag/tap gesture ends — the right moment to commit undo history.
   * `startValue` is the value this field held before the gesture began, so the caller
   * can record a `{from, to}` operation without tracking it separately.
   */
  onSlidingComplete?: (value: number, startValue: number) => void;
}

/**
 * Custom square-handle slider matching the flat 2015 spec: 2px track, 12px square thumb,
 * right-aligned monospace value. React Native's community slider has a round thumb and
 * doesn't match, so this is a bespoke gesture-handler + reanimated implementation.
 */
export function Slider({
  label,
  value,
  min,
  max,
  unit = '',
  step = 1,
  bipolar = false,
  trackColor,
  gradientColors,
  showSign = false,
  labelWidth = 90,
  onChange,
  onSlidingComplete,
}: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const echo = useRef(createEchoTracker(value)).current;
  const isDragging = useSharedValue(false);

  // Drives the thumb/fill directly on the UI thread — the finger tracks this every frame
  // with no JS bridge hop, so it stays smooth even while `onChange` below is busy re-running
  // the (expensive) color-adjustment shader on the JS thread.
  const pctSV = useSharedValue(toPct(value, min, max));

  // Values we emitted via onChange that the parent may still echo back late. A stale echo
  // (older than the latest emitted value) must not yank the thumb backwards (the rollback).
  useEffect(() => {
    if (!echo.onPropValue(value).apply) return;
    if (!isDragging.value) {
      pctSV.value = toPct(value, min, max);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, max]);

  // Refs written inside worklets only mutate a UI-thread copy, so the gesture start value
  // must be captured on the JS thread (it was always the mount-time value before).
  const beginGesture = useCallback(() => {
    echo.begin();
  }, [echo]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const commitValue = useCallback(
    (next: number) => {
      echo.emit(next);
      onChange(next);
    },
    [onChange, echo]
  );

  const commitSlidingComplete = useCallback(() => {
    const { value: v, from } = echo.complete();
    onSlidingComplete?.(v, from);
  }, [onSlidingComplete, echo]);

  // Only every 3rd touch-move actually re-renders the (expensive) preview — that's still a
  // smooth ~20-40Hz update given native gesture callbacks fire at 60-120Hz, and it's the
  // fix for the real cost here: not the gesture itself, but everything downstream of
  // `onChange` (React re-render + shader-uniform recompute + GPU redraw) on every touch event.
  const frameCounter = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin((e) => {
      isDragging.value = true;
      frameCounter.value = 0;
      if (trackWidth <= 0) return;
      const next = snapValue(e.x, trackWidth, min, max, step);
      pctSV.value = toPct(next, min, max);
      runOnJS(beginGesture)();
      runOnJS(commitValue)(next);
    })
    .onUpdate((e) => {
      if (trackWidth <= 0) return;
      const next = snapValue(e.x, trackWidth, min, max, step);
      pctSV.value = toPct(next, min, max);
      frameCounter.value += 1;
      if (frameCounter.value % 3 === 0) {
        runOnJS(commitValue)(next);
      }
    })
    .onEnd((e) => {
      isDragging.value = false;
      if (trackWidth > 0) {
        const next = snapValue(e.x, trackWidth, min, max, step);
        runOnJS(commitValue)(next);
      }
      runOnJS(commitSlidingComplete)();
    });

  // No beginGesture here: Pan.onBegin already fires on every touch-down, and a second begin()
  // after Pan emitted would reset `from` to the already-emitted value.
  const tap = Gesture.Tap()
    .onEnd((e) => {
      if (trackWidth <= 0) return;
      const next = snapValue(e.x, trackWidth, min, max, step);
      pctSV.value = toPct(next, min, max);
      runOnJS(commitValue)(next);
      runOnJS(commitSlidingComplete)();
    });

  const gesture = Gesture.Race(pan, tap);

  const fillStyle = useAnimatedStyle(() => ({ width: `${pctSV.value}%` }));
  const thumbStyle = useAnimatedStyle(() => ({ left: `${pctSV.value}%` }));

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { width: labelWidth }]} numberOfLines={1}>
        {label}
      </Text>
      <GestureDetector gesture={gesture}>
        <View style={styles.trackHit} onLayout={onLayout}>
          <View
            style={[
              styles.track,
              !gradientColors && { backgroundColor: trackColor ?? colors.linha },
            ]}
          >
            {gradientColors && trackWidth > 0 && (
              <Svg width={trackWidth} height={2} style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="trackGradient" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={gradientColors[0]} />
                    <Stop offset="1" stopColor={gradientColors[1]} />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={trackWidth} height={2} fill="url(#trackGradient)" />
              </Svg>
            )}
            {!trackColor && !gradientColors && <Animated.View style={[styles.fill, fillStyle]} />}
            {bipolar && <View style={styles.centerTick} />}
            <Animated.View style={[styles.thumb, thumbStyle]} />
          </View>
        </View>
      </GestureDetector>
      <Text style={styles.value}>
        {showSign && value > 0 ? `+${value}` : value}
        {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  label: {
    color: colors.texto2,
    fontSize: fontSize.xs,
    flexShrink: 0,
  },
  trackHit: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  track: {
    height: 2,
    width: '100%',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    backgroundColor: colors.acento,
  },
  centerTick: {
    position: 'absolute',
    left: '50%',
    top: -3,
    width: 1,
    height: 8,
    marginLeft: -0.5,
    backgroundColor: colors.texto2,
  },
  thumb: {
    position: 'absolute',
    top: -5,
    marginLeft: -6,
    width: 12,
    height: 12,
    backgroundColor: colors.texto,
  },
  value: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto,
    width: 44,
    textAlign: 'right',
    flexShrink: 0,
  },
});
