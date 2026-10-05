import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, monoFontFamily } from '@core/theme';

interface Props {
  countdown: number | null;
}

const CountdownOverlay = memo(function CountdownOverlay({ countdown }: Props) {
  if (countdown === null) return null;

  return (
    <View style={styles.countdownOverlay}>
      <Text style={styles.countdownText}>{countdown}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  countdownText: {
    fontFamily: monoFontFamily,
    fontSize: 96,
    fontWeight: '700',
    color: colors.branco,
  },
});

export default CountdownOverlay;
