import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { EditorFrame } from '@/web-preview/EditorFrame';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoEditor'>;

/** Web design preview only (docs/web-preview.md). The app hosts the built editor in a WebView. */
export default function VideoEditorWebScreen({ navigation }: Props) {
  return (
    <EditorFrame src="http://localhost:5174/" onBack={() => navigation.navigate('Projects')} />
  );
}
