import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProjectHubScreen from '../screens/ProjectHubScreen';
import PhotoEditorSpikeScreen from '../screens/PhotoEditorSpikeScreen';

export type RootStackParamList = {
  ProjectHub: undefined;
  PhotoEditorSpike: undefined;
  PhotoEditor: undefined;
  VideoEditor: undefined;
  Camera: undefined;
  Export: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ProjectHub" component={ProjectHubScreen} />
      <Stack.Screen name="PhotoEditorSpike" component={PhotoEditorSpikeScreen} />
    </Stack.Navigator>
  );
}
