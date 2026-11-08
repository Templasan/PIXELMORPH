import { memo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, monoFontFamily } from '@core/theme';

interface Props {
  stopFrames: string[];
}

/** Captured frames above the mode row. Centred while they fit; scrolls once they do not. */
const StopMotionFrameStrip = memo(function StopMotionFrameStrip({ stopFrames }: Props) {
  if (stopFrames.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.content}
    >
      {stopFrames.map((uri, i) => (
        <View key={i} style={styles.frame}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} />
          <Text style={styles.frameNum}>{i + 1}</Text>
        </View>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  strip: {
    flexGrow: 0,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  frame: {
    width: 44,
    height: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.linha,
    backgroundColor: 'rgba(26,26,26,0.85)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameNum: {
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
