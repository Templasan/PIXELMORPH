import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize } from '../theme';

interface SwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}

/** Material-2015-style switch: thin track, circular thumb that slides past the track edge. */
export function Switch({ value, onChange, label }: SwitchProps) {
  return (
    <Pressable style={styles.row} onPress={() => onChange(!value)} hitSlop={8}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  label: {
    color: colors.texto,
    fontSize: fontSize.md,
    flex: 1,
  },
  track: {
    width: 36,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.linha,
    justifyContent: 'center',
  },
  trackOn: {
    backgroundColor: colors.acentoFraco2,
  },
  thumb: {
    position: 'absolute',
    top: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: colors.preto,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  thumbOff: {
    left: -2,
    backgroundColor: colors.texto2,
  },
  thumbOn: {
    left: 16,
    backgroundColor: colors.acento,
  },
});
