import { memo, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { TimeStore } from './timeStore';

/** The playhead line: moves on the UI thread from a shared value, never re-renders on a tick. */
export const Playhead = memo(function Playhead({
  store,
  totalMs,
  style,
}: {
  store: TimeStore;
  totalMs: number;
  style: StyleProp<ViewStyle>;
}) {
  const timeMs = useSharedValue(store.get());
  const total = useSharedValue(totalMs);
  useEffect(() => {
    total.value = totalMs;
  }, [total, totalMs]);
  useEffect(() => {
    timeMs.value = store.get();
    return store.subscribe(() => {
      timeMs.value = store.get();
    });
  }, [store, timeMs]);
  const animated = useAnimatedStyle(() => ({ left: `${(timeMs.value / total.value) * 100}%` }));
  return <Animated.View style={[style, animated]} />;
});
