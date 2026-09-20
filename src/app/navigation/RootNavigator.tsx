import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import CameraScreen from '../screens/CameraScreen';
import PhotoEditorScreen from '../screens/PhotoEditorScreen';
import RawConverterScreen from '../screens/RawConverterScreen';
import VideoEditorScreen from '../screens/VideoEditorScreen';
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

export default function RootNavigator() {
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
