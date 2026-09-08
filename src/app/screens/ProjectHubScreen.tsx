import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectHub'>;

export default function ProjectHubScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>PixelMorph</Text>
        <Text style={styles.subtitle}>Photo & Video Editing</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Project Hub - Foundation Ready</Text>
          <Text style={styles.placeholderDescription}>
            This is the project hub screen. Additional features will be added here.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.spikeButton}
          onPress={() => navigation.navigate('PhotoEditorSpike')}
        >
          <Text style={styles.spikeButtonText}>→ Test Photo Editor Spike</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 40,
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  placeholderDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  spikeButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  spikeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
