import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioRecorderState, type AudioRecorder } from 'expo-audio';
import { Icon } from '@core/ui';
import { colors } from '@core/theme';
import { meteringToPercent } from './cameraFormat';

interface Props {
  /** Its level is polled here, so only the meter redraws ten times a second, not the camera screen. */
  recorder: AudioRecorder;
  /** RF-018: mic gain (1 = as captured); the meter shows the level with it applied. */
  gain: number;
  onGain: (gain: number) => void;
}

const GAIN_STEP = 0.25;
const MAX_GAIN = 2;

/** Vertical bar on the right edge: gain up on top, down at the bottom, the level fills from below. */
const AudioMeter = memo(function AudioMeter({ recorder, gain, onGain }: Props) {
  const { metering } = useAudioRecorderState(recorder, 100);
  const level = metering === undefined || gain <= 0 ? undefined : metering + 20 * Math.log10(gain);
  return (
    <View style={styles.wrap}>
      <Icon name="mic" size={14} color={colors.texto} />
      <Pressable
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel="Aumentar ganho"
        onPress={() => onGain(Math.min(MAX_GAIN, gain + GAIN_STEP))}
        style={styles.gainBtn}
      >
        <Text style={styles.gainButton}>+</Text>
      </Pressable>
      <View style={styles.track}>
        <View style={[styles.fill, { height: `${meteringToPercent(level)}%` }]} />
      </View>
      <Pressable
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel="Diminuir ganho"
        onPress={() => onGain(Math.max(0, gain - GAIN_STEP))}
        style={styles.gainBtn}
      >
        <Text style={styles.gainButton}>−</Text>
      </Pressable>
      <Text style={styles.gainText}>{Math.round(gain * 100)}%</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  gainBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gainButton: {
    color: colors.texto,
    fontSize: 20,
  },
  track: {
    width: 6,
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    backgroundColor: colors.ok,
  },
  gainText: {
    color: colors.texto,
    fontSize: 11,
    width: 44,
    textAlign: 'center',
  },
});

export default AudioMeter;
