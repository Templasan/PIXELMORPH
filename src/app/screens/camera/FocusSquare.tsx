import { memo } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colors } from '@core/theme';

interface Props {
  focusPoint: { x: number; y: number } | null;
  focusAnim: Animated.Value;
}

const FocusSquare = memo(function FocusSquare({ focusPoint, focusAnim }: Props) {
  if (!focusPoint) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.focusSquare,
        {
          left: focusPoint.x - 32,
          top: focusPoint.y - 32,
          opacity: focusAnim,
          transform: [
            {
              scale: focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }),
            },
          ],
        },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  focusSquare: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderWidth: 1.5,
    borderColor: colors.branco,
  },
});

export default FocusSquare;
