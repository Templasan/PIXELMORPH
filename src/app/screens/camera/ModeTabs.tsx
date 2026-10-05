import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@core/theme';
import { MODES, type CameraMode } from './cameraFormat';

interface Props {
  mode: CameraMode;
  onModeChange: (mode: CameraMode) => void;
}

const ModeTabs = memo(function ModeTabs({ mode, onModeChange }: Props) {
  return (
    <View style={styles.modeSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.modeRow}
      >
        {MODES.map((m) => (
          <Pressable key={m} onPress={() => onModeChange(m)}>
            <Text style={[styles.modeLabel, mode === m && styles.modeLabelActive]}>{m}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  modeSection: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingVertical: 8,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 16,
  },
  modeLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.texto2,
  },
  modeLabelActive: {
    color: colors.acento,
    fontWeight: '500',
  },
});

export default ModeTabs;
