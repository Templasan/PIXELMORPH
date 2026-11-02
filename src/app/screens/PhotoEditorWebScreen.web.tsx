import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppCompositionRoot } from '../CompositionRoot';
import { EditorFrame } from '@/web-preview/EditorFrame';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoEditor'>;

/** Web design preview only (docs/web-preview.md). The app hosts the built editor in a WebView. */
export default function PhotoEditorWebScreen({ navigation, route }: Props) {
  const projectId = route.params?.projectId;
  const start = route.params?.start;
  const [src, setSrc] = useState<string | null>(
    projectId ? null : `http://localhost:5175/${start ? `?start=${start}` : ''}`
  );

  useEffect(() => {
    if (!projectId) return;
    void AppCompositionRoot.projects.getProject.execute(projectId).then((project) => {
      const file = project?.assets[0]?.workingUri.split('/media/')[1];
      setSrc(`http://localhost:5175/${file ? `?photo=${file}` : ''}`);
    });
  }, [projectId]);

  return src ? <EditorFrame src={src} onBack={() => navigation.goBack()} /> : null;
}
