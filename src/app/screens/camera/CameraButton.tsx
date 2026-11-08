import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '@core/ui';
import { colors } from '@core/theme';

interface Props {
  icon: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** Shown next to the icon; a label makes the button a 44 px pill instead of a circle. */
  label?: string;
  /** Accent fill for a feature that is on. */
  active?: boolean;
  disabled?: boolean;
  /** Circle diameter, for the round buttons that are not in the top bar. */
  size?: number;
}

/** Translucent control over the preview. Every control is at least 44 px. */
export const CameraButton = memo(function CameraButton({
  icon,
  accessibilityLabel,
  onPress,
  label,
  active = false,
  disabled = false,
  size = 44,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      style={[
        styles.base,
        label !== undefined ? styles.pill : { width: size, height: size, borderRadius: size / 2 },
        active && styles.active,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={icon} size={22} color={colors.branco} />
      {label !== undefined && <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pill: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  active: {
    backgroundColor: colors.acento,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: colors.branco,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
