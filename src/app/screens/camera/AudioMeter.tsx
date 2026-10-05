import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@core/ui';
import { colors } from '@core/theme';
import { meteringToPercent } from './cameraFormat';

interface Props {
  metering: number | undefined;
}

const AudioMeter = memo(function AudioMeter({ metering }: Props) {
  return (
    <View style={styles.audioMeterWrap}>
      <Icon name="mic" size={14} color={colors.texto2} />
      <View style={styles.audioMeterTrack}>
        <View style={[styles.audioMeterFill, { width: `${meteringToPercent(metering)}%` }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
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
