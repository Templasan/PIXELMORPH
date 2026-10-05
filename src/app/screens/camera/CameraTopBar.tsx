import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CameraType } from 'expo-camera';
import { Icon } from '@core/ui';
import { colors, monoFontFamily } from '@core/theme';

interface Props {
  torch: boolean;
  onTorchChange: (enabled: boolean) => void;
  facing: CameraType;
  onFacingChange: (facing: CameraType) => void;
  onBack: () => void;
}

const CameraTopBar = memo(function CameraTopBar({
  torch,
  onTorchChange,
  facing,
  onFacingChange,
  onBack,
}: Props) {
  return (
    <View style={styles.topControls}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Icon name="chevronLeft" size={24} color={colors.branco} />
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <Pressable onPress={() => onTorchChange(!torch)} hitSlop={8}>
          <Icon name="flash" size={20} color={torch ? colors.acento : colors.branco} />
        </Pressable>
        <Icon name="grid" size={20} color={colors.branco} />
        <Pressable onPress={() => onFacingChange(facing === 'back' ? 'front' : 'back')} hitSlop={8}>
          <Icon name="rotate" size={20} color={colors.branco} />
        </Pressable>
      </View>
      <View style={styles.fpsBadge}>
        <Text style={styles.fpsBadgeText}>60 FPS</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  fpsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.ok,
    backgroundColor: 'rgba(95,185,143,0.2)',
  },
  fpsBadgeText: {
    fontFamily: monoFontFamily,
    fontSize: 11,
    color: colors.ok,
  },
});

export default CameraTopBar;
