import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

/** Rule-of-thirds lines over the preview. */
const GridOverlay = memo(function GridOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.vertical, { left: '33.3333%' }]} />
      <View style={[styles.vertical, { left: '66.6667%' }]} />
      <View style={[styles.horizontal, { top: '33.3333%' }]} />
      <View style={[styles.horizontal, { top: '66.6667%' }]} />
    </View>
  );
});

const LINE = 'rgba(255,255,255,0.28)';

const styles = StyleSheet.create({
  vertical: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: LINE },
  horizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: LINE },
});

export default GridOverlay;
