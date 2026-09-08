import { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkiaSpike } from '@modules/photo-editor/spike/SkiaSpike';

export default function PhotoEditorSpikeScreen() {
  const [spikeActive, setSpikeActive] = useState(false);

  // Use a built-in test image URL (you can replace with actual project image)
  // For spike validation, we use Expo's built-in test image
  const testImageUri =
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop';

  if (spikeActive) {
    return (
      <View style={styles.spikeContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => setSpikeActive(false)}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <SkiaSpike imageUri={testImageUri} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Photo Editor Spike</Text>
        <Text style={styles.subtitle}>Validate Skia Integration</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Spike Validation Checklist</Text>
          <Text style={styles.infoText}>✓ React Native Skia 2.11.2+</Text>
          <Text style={styles.infoText}>✓ Expo SDK 56 compatibility</Text>
          <Text style={styles.infoText}>✓ React Native 0.85 + New Architecture</Text>
          <Text style={styles.infoText}>✓ Expo Development Build</Text>
          <Text style={styles.infoText}>✓ Image rendering</Text>
          <Text style={styles.infoText}>✓ Pinch-to-zoom gesture</Text>
          <Text style={styles.infoText}>✓ Pan/drag gesture</Text>
          <Text style={styles.infoText}>✓ 60 FPS performance</Text>
        </View>

        <TouchableOpacity style={styles.testButton} onPress={() => setSpikeActive(true)}>
          <Text style={styles.testButtonText}>Start Spike Test</Text>
        </TouchableOpacity>

        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsTitle}>Instructions</Text>
          <Text style={styles.instructionsText}>
            1. Press "Start Spike Test" to load the Skia image viewer{'\n'}
            2. Use pinch gesture to zoom in/out{'\n'}
            3. Use drag gesture to pan when zoomed{'\n'}
            4. Check console for any errors{'\n'}
            5. Verify smooth 60 FPS rendering
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#333333',
    marginVertical: 3,
    fontFamily: 'monospace',
  },
  testButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsBox: {
    backgroundColor: '#fffbea',
    borderLeftWidth: 4,
    borderLeftColor: '#FFA726',
    padding: 15,
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    color: '#333333',
    lineHeight: 20,
  },
  spikeContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  backButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
});
