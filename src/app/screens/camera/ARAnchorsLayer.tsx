import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@core/theme';
import { useARTracking, type ARAnchor } from '@modules/camera/ar';

const BASE_SIZE = 56;

/**
 * RF-024 (MVP): the AR anchors drawn over the live camera preview. They are placed in screen
 * space and follow the device tilt (gyroscope parallax), which is what the anchor model supports;
 * true surface tracking would need ARCore. The gyro subscription lives here, so tilting re-renders
 * this layer only — it used to re-render the whole camera screen at 60 Hz.
 */
export const ARAnchorsLayer = memo(function ARAnchorsLayer({
  anchors,
  selectedId,
}: {
  anchors: ARAnchor[];
  selectedId: string | null;
}) {
  const offset = useARTracking(true, 0.08);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {anchors
        .filter((a) => a.visible)
        .map((a) => {
          const size = BASE_SIZE * a.scale;
          const selected = a.id === selectedId;
          return (
            <View
              key={a.id}
              style={[
                styles.anchor,
                {
                  left: `${(a.x + offset.x) * 100}%`,
                  top: `${(a.y + offset.y) * 100}%`,
                  width: size,
                  height: size,
                  marginLeft: -size / 2,
                  marginTop: -size / 2,
                  transform: [{ rotate: `${a.rotation}deg` }],
                },
              ]}
            >
              <AnchorShape anchor={a} size={size} selected={selected} />
            </View>
          );
        })}
    </View>
  );
});

function AnchorShape({
  anchor,
  size,
  selected,
}: {
  anchor: ARAnchor;
  size: number;
  selected: boolean;
}) {
  const outline = selected ? { borderWidth: 2, borderColor: colors.branco } : null;
  switch (anchor.type) {
    case 'circle':
      return (
        <View
          style={[styles.fill, { backgroundColor: anchor.color, borderRadius: size / 2 }, outline]}
        />
      );
    case 'square':
      return <View style={[styles.fill, { backgroundColor: anchor.color }, outline]} />;
    case 'triangle':
      return (
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: size / 2,
            borderRightWidth: size / 2,
            borderBottomWidth: size,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: anchor.color,
          }}
        />
      );
    case 'text':
      return (
        <Text
          style={[styles.text, { color: anchor.color, fontSize: size / 2.5 }]}
          numberOfLines={1}
        >
          {anchor.text ?? 'Texto'}
        </Text>
      );
  }
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%', opacity: 0.9 },
  text: { fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
});
