import { memo, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors } from '@core/theme';

export interface LastCapture {
  uri: string;
  kind: 'image' | 'video';
}

/**
 * Three slots of equal width. The side slots are the same width as the centre one, so the shutter
 * sits on the middle of the screen whatever the sides hold.
 */
export function ShutterRow({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.slot}>{left}</View>
      <View style={styles.slot}>{center}</View>
      <View style={styles.slot}>{right}</View>
    </View>
  );
}

/** Not a button: the last capture is only shown, not opened from here. */
export const LastCaptureThumb = memo(function LastCaptureThumb({
  capture,
}: {
  capture: LastCapture | null;
}) {
  return (
    <View style={styles.thumb} accessibilityLabel="Última captura">
      {capture?.kind === 'image' && (
        <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} />
      )}
      {capture?.kind === 'video' && <Icon name="film" size={22} color={colors.texto2} />}
    </View>
  );
});

interface ShutterProps {
  variant: 'photo' | 'video' | 'recording';
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}

/** White ring; the disc is white for photos, red for video, and a red square while recording. */
export const ShutterButton = memo(function ShutterButton({
  variant,
  accessibilityLabel,
  disabled = false,
  onPress,
}: ShutterProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.ring, disabled && styles.disabled]}
    >
      {variant === 'recording' ? (
        <View style={styles.square} />
      ) : (
        <View
          style={[
            styles.disc,
            { backgroundColor: variant === 'video' ? colors.perigo : colors.branco },
          ]}
        />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  slot: {
    flex: 1,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.branco,
    backgroundColor: 'rgba(0,0,0,0.35)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  disc: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  square: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: colors.perigo,
  },
});
