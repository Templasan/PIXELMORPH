import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@core/theme';

const AROverlay = memo(function AROverlay() {
  return (
    <View style={styles.arOverlay} pointerEvents="none">
      <View style={styles.arBox}>
        {Array.from({ length: 25 }).map((_, i) => (
          <View
            key={i}
            style={[styles.arDot, { left: `${(i % 5) * 25}%`, top: `${Math.floor(i / 5) * 25}%` }]}
          />
        ))}
        <View style={styles.arFrame} />
        <View style={styles.arLabel}>
          <Text style={styles.arLabelText}>Superfície detectada</Text>
        </View>
      </View>
      {/* TODO: real AR needs expo-gl / ARKit-ARCore anchoring, model library, and
          Mover/Girar/Escalar gizmo controls — this is a static illustration of the state. */}
    </View>
  );
});

const styles = StyleSheet.create({
  arOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arBox: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  arDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(58,143,222,0.75)',
  },
  arFrame: {
    position: 'absolute',
    top: 40,
    left: 40,
    right: 40,
    bottom: 40,
    borderWidth: 2,
    borderColor: 'rgba(58,143,222,0.8)',
  },
  arLabel: {
    position: 'absolute',
    bottom: 16,
    right: -16,
    backgroundColor: 'rgba(58,143,222,0.15)',
    borderWidth: 1,
    borderColor: colors.acento,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  arLabelText: {
    fontSize: 10,
    color: colors.acento,
  },
});

export default AROverlay;
