import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@core/theme';
import { formatElapsed } from './cameraFormat';

/** Red pill with the elapsed time of the take. Tabular figures keep the digits from jittering. */
const RecordingPill = memo(function RecordingPill({ seconds }: { seconds: number }) {
  const time = formatElapsed(seconds);
  return (
    <View style={styles.pill} accessibilityLabel={`Gravando ${time}`}>
      <View style={styles.dot} />
      <Text style={styles.time}>{time}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.perigo,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.branco,
  },
  time: {
    color: colors.branco,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});

export default RecordingPill;
