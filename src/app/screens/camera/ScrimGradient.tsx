import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface Props {
  edge: 'top' | 'bottom';
  height: number;
}

/** Black fade behind the controls so they read over a bright preview: 55% at the top, 75% at the bottom. */
export const ScrimGradient = memo(function ScrimGradient({ edge, height }: Props) {
  const top = edge === 'top';
  const id = `scrim-${edge}`;
  return (
    <View pointerEvents="none" style={[styles.wrap, top ? { top: 0 } : { bottom: 0 }, { height }]}>
      <Svg width="100%" height={height} viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={top ? 0.55 : 0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={top ? 0 : 0.75} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
