import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EditorLayer } from './Layer';

/**
 * RF-002/RF-052/RF-033 + RNF-005: the layer stack (paint strokes, text, shapes, visibility,
 * opacity) saved per project, so closing the editor no longer throws the layers away.
 * Everything in an EditorLayer is plain JSON. The `layers:` prefix is mirrored in the projects
 * repository (deleting a project removes its layers) and in the storage-usage report.
 */
const LAYERS_KEY_PREFIX = 'layers:';

export async function saveLayers(projectId: string, layers: EditorLayer[]): Promise<void> {
  await AsyncStorage.setItem(`${LAYERS_KEY_PREFIX}${projectId}`, JSON.stringify(layers));
}

function isLayerList(value: unknown): value is EditorLayer[] {
  return (
    Array.isArray(value) &&
    value.every((l) => l && typeof l.id === 'string' && typeof l.kind === 'string') &&
    value.some((l) => l.id === 'fundo') // the fixed background layer must be there
  );
}

/** Returns the saved layers, or null when there are none or the saved data is unusable. */
export async function loadLayers(projectId: string): Promise<EditorLayer[] | null> {
  const json = await AsyncStorage.getItem(`${LAYERS_KEY_PREFIX}${projectId}`);
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return isLayerList(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
