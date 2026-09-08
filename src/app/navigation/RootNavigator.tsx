import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProjectHubScreen from '../screens/ProjectHubScreen';

export type RootStackParamList = {
  ProjectHub: undefined;
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
    </Stack.Navigator>
  );
}
