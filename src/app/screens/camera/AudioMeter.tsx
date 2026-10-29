import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors } from '@core/theme';
import { meteringToPercent } from './cameraFormat';

interface Props {
  metering: number | undefined;
  /** RF-018: mic gain (1 = as captured); the meter shows the level with it applied. */
  gain: number;
  onGain: (gain: number) => void;
}

const GAIN_STEP = 0.25;
const MAX_GAIN = 2;

const AudioMeter = memo(function AudioMeter({ metering, gain, onGain }: Props) {
  const level = metering === undefined || gain <= 0 ? undefined : metering + 20 * Math.log10(gain);
  return (
    <View style={styles.audioMeterWrap}>
      <Icon name="mic" size={14} color={colors.texto2} />
      <View style={styles.audioMeterTrack}>
        <View style={[styles.audioMeterFill, { width: `${meteringToPercent(level)}%` }]} />
      </View>
      <Pressable
        hitSlop={8}
        accessibilityLabel="Diminuir ganho"
        onPress={() => onGain(Math.max(0, gain - GAIN_STEP))}
      >
        <Text style={styles.gainButton}>−</Text>
      </Pressable>
      <Text style={styles.gainText}>{Math.round(gain * 100)}%</Text>
      <Pressable
        hitSlop={8}
        accessibilityLabel="Aumentar ganho"
        onPress={() => onGain(Math.min(MAX_GAIN, gain + GAIN_STEP))}
      >
        <Text style={styles.gainButton}>+</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  gainButton: { color: colors.texto, fontSize: 18, paddingHorizontal: 6 },
  gainText: { color: colors.texto, fontSize: 12, minWidth: 40, textAlign: 'center' },
  audioMeterWrap: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  audioMeterTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  audioMeterFill: {
    height: '100%',
    backgroundColor: colors.ok,
  },
});

export default AudioMeter;
