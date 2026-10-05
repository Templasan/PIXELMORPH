import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CameraType } from 'expo-camera';
import { Icon } from '@core/ui';
import { colors } from '@core/theme';
import type { CameraMode } from './cameraFormat';

interface Props {
  lastCaptureUri: string | null;
  onShutter: () => void;
  facing: CameraType;
  onFacingChange: (facing: CameraType) => void;
  busy: boolean;
  recording: boolean;
  mode: CameraMode;
}

const CaptureControls = memo(function CaptureControls({
  lastCaptureUri,
  onShutter,
  facing,
  onFacingChange,
  busy,
  recording,
  mode,
}: Props) {
  return (
    <View style={styles.controlsRow}>
      <View style={styles.lastCaptureWrap}>
        {lastCaptureUri && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.faixa }]} />
        )}
      </View>

      <Pressable
        onPress={onShutter}
        disabled={busy && !recording}
        style={[
          styles.shutter,
          (mode === 'STOP-MOTION' || (mode === 'VÍDEO' && recording)) && styles.shutterRecording,
          busy && { opacity: 0.5 },
        ]}
      >
        {mode === 'VÍDEO' ? (
          <View
            style={[
              styles.shutterInner,
              recording ? styles.shutterSquareSmall : styles.shutterCircleLarge,
              { backgroundColor: colors.perigo },
            ]}
          />
        ) : mode === 'STOP-MOTION' ? (
          <View style={[styles.shutterSquareSmall, { backgroundColor: colors.perigo }]} />
        ) : (
          <View style={[styles.shutterCircleLarge, { backgroundColor: colors.branco }]} />
        )}
      </Pressable>

      <Pressable onPress={() => onFacingChange(facing === 'back' ? 'front' : 'back')} hitSlop={8}>
        <Icon name="rotate" size={28} color={colors.icone} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  controlsRow: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  lastCaptureWrap: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: colors.linha,
    overflow: 'hidden',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRecording: {
    borderColor: colors.perigo,
  },
  shutterInner: {},
  shutterCircleLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  shutterSquareSmall: {
    width: 20,
    height: 20,
    borderRadius: 2,
  },
});

export default CaptureControls;
