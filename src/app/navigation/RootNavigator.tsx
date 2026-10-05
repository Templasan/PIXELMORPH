import { Suspense, lazy, useEffect, type ComponentType } from 'react';
import { InteractionManager, View } from 'react-native';
import { colors } from '@core/theme';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import TutorialsScreen from '../screens/TutorialsScreen';
import PresetsScreen from '../screens/PresetsScreen';
import StorageScreen from '../screens/StorageScreen';
import AccountScreen from '../screens/AccountScreen';
import HelpScreen from '../screens/HelpScreen';
import PhotoEditorSpikeScreen from '../screens/PhotoEditorSpikeScreen';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Projects: undefined;
  Camera: undefined;
  PhotoEditor: { projectId?: string } | undefined;
  /** RF-003: RAW converter — white balance + tone curve, then hands off to PhotoEditor. */
  RawConverter: {
    sourceUri: string;
    sourceName: string;
    rawFormatLabel: string;
    rawMimeType: string;
  };
  VideoEditor: { projectId?: string } | undefined;
  Community: undefined;
  Tutorials: undefined;
  Presets: undefined;
  Storage: undefined;
  Account: undefined;
  Help: undefined;
  /** TASK-003 technical spike, kept reachable from Account > Diagnóstico for regression testing. */
  PhotoEditorSpike: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Heavy screens (Skia/video/camera) load on demand; the fallback matches the screen
// background so the fade transition never flashes white. They are warmed up in idle time
// (see RootNavigator) so the first tap barely waits.
const loaders = {
  Camera: () => import('../screens/CameraScreen'),
  PhotoEditor: () => import('../screens/PhotoEditorScreen'),
  RawConverter: () => import('../screens/RawConverterScreen'),
  VideoEditor: () => import('../screens/VideoEditorScreen'),
};

function lazyScreen<K extends keyof RootStackParamList>(
  load: () => Promise<{ default: ComponentType<NativeStackScreenProps<RootStackParamList, K>> }>
) {
  const Screen = lazy(load);
  return function LazyScreen(props: NativeStackScreenProps<RootStackParamList, K>) {
    return (
      <Suspense fallback={<View style={{ flex: 1, backgroundColor: colors.canvas }} />}>
        <Screen {...props} />
      </Suspense>
    );
  };
}

const CameraScreen = lazyScreen(loaders.Camera);
const PhotoEditorScreen = lazyScreen(loaders.PhotoEditor);
const RawConverterScreen = lazyScreen(loaders.RawConverter);
const VideoEditorScreen = lazyScreen(loaders.VideoEditor);

export default function RootNavigator() {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      Object.values(loaders).forEach((load) => void load().catch(() => {}));
    });
    return () => task.cancel();
  }, []);
  return (
    <Stack.Navigator
      initialRouteName="Projects"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Projects" component={ProjectsScreen} />
      <Stack.Screen name="Camera" component={CameraScreen} />
      <Stack.Screen name="PhotoEditor" component={PhotoEditorScreen} />
      <Stack.Screen name="RawConverter" component={RawConverterScreen} />
      <Stack.Screen name="VideoEditor" component={VideoEditorScreen} />
      <Stack.Screen name="Community" component={CommunityScreen} />
      <Stack.Screen name="Tutorials" component={TutorialsScreen} />
      <Stack.Screen name="Presets" component={PresetsScreen} />
      <Stack.Screen name="Storage" component={StorageScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="PhotoEditorSpike" component={PhotoEditorSpikeScreen} />
    </Stack.Navigator>
  );
}
