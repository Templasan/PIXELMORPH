import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface Props {
  /** The last captured stop-motion frame, drawn so the next frame lines up with it. */
  uri: string;
  opacity: number;
}

const OnionSkin = memo(function OnionSkin({ uri, opacity }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={{ uri }} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity }]} />
    </View>
  );
});

export default OnionSkin;
