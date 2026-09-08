import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SkiaSpikeProps {
  imageUri: string;
}

export function SkiaSpike({ imageUri }: SkiaSpikeProps) {
  const image = useImage(imageUri);

  // Zoom & Pan state
  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startScale = useSharedValue(1);

  // Gesture handlers
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event: any) => {
      scale.value = startScale.value * event.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
      } else if (scale.value > 5) {
        scale.value = withSpring(5);
      }
      startScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event: any) => {
      if (scale.value > 1) {
        offsetX.value = event.translationX;
        offsetY.value = event.translationY;
      }
    })
    .onEnd(() => {
      // Reset to bounds
      offsetX.value = withSpring(0);
      offsetY.value = withSpring(0);
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Render callback using Skia
  const handleCanvas = () => {
    if (!image) return null;

    return (
      <Canvas style={{ flex: 1 }}>
        <SkiaImage
          image={image}
          x={SCREEN_WIDTH / 2 - (image.width() * scale.value) / 2 + offsetX.value}
          y={SCREEN_HEIGHT / 2 - (image.height() * scale.value) / 2 + offsetY.value}
          width={image.width() * scale.value}
          height={image.height() * scale.value}
        />
      </Canvas>
    );
  };

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container]}>
        {image ? handleCanvas() : <Text style={styles.loadingText}>Loading image...</Text>}
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>Spike: Skia Image Render + Zoom/Pan</Text>
          <Text style={styles.debugText}>Scale: {scale.value.toFixed(2)}x</Text>
          <Text style={styles.debugText}>Pinch to zoom • Drag to pan</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  debugInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
  },
  debugText: {
    color: '#0f0',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
