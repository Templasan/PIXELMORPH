import { memo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, monoFontFamily } from '@core/theme';

interface Props {
  stopFrames: string[];
}

const StopMotionFrameStrip = memo(function StopMotionFrameStrip({ stopFrames }: Props) {
  if (stopFrames.length === 0) return null;

  return (
    <ScrollView horizontal style={styles.stopFramesRow} showsHorizontalScrollIndicator={false}>
      {stopFrames.map((uri, i) => (
        <View key={i} style={styles.stopFrame}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} />
          <Text style={styles.stopFrameNum}>{i + 1}</Text>
        </View>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  stopFramesRow: {
    position: 'absolute',
    top: 56,
    left: 8,
    right: 8,
  },
  stopFrame: {
    width: 48,
    height: 48,
    marginRight: 4,
    backgroundColor: 'rgba(26,26,26,0.85)',
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopFrameNum: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    fontWeight: '600',
    color: colors.branco,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});

export default StopMotionFrameStrip;
