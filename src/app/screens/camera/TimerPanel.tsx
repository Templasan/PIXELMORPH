import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@core/theme';

const SECONDS = [3, 5, 10];

/** RF-039: how long the countdown before the photo lasts. */
const TimerPanel = memo(function TimerPanel({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  return (
    <View style={styles.row}>
      {SECONDS.map((s) => (
        <Pressable
          key={s}
          onPress={() => onChange(s)}
          style={[styles.chip, s === seconds && styles.chipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: s === seconds }}
        >
          <Text style={[styles.text, s === seconds && styles.textOn]}>{s} s</Text>
        </Pressable>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  chip: {
    minWidth: 64,
    height: 48,
    borderWidth: 1,
    borderColor: colors.linha,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: colors.texto,
  },
  text: {
    fontSize: 13,
    color: colors.texto2,
  },
  textOn: {
    color: colors.texto,
    fontWeight: '600',
  },
});

export default TimerPanel;
