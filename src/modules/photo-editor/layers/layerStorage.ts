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

/** RF-075/RF-028: the external images (double exposure, overlay) a project uses, kept per project. */
export interface EditorImage {
  name: string;
  uri: string;
}
export interface EditorImages {
  doubleExposure: EditorImage | null;
  overlay: EditorImage | null;
}

const IMAGES_KEY_PREFIX = 'editorImages:';

export async function saveEditorImages(projectId: string, images: EditorImages): Promise<void> {
  await AsyncStorage.setItem(`${IMAGES_KEY_PREFIX}${projectId}`, JSON.stringify(images));
}

export async function loadEditorImages(projectId: string): Promise<EditorImages | null> {
  const json = await AsyncStorage.getItem(`${IMAGES_KEY_PREFIX}${projectId}`);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<EditorImages>;
    const valid = (i: unknown): i is EditorImage =>
      !!i &&
      typeof (i as EditorImage).uri === 'string' &&
      typeof (i as EditorImage).name === 'string';
    return {
      doubleExposure: valid(parsed.doubleExposure) ? parsed.doubleExposure : null,
      overlay: valid(parsed.overlay) ? parsed.overlay : null,
    };
  } catch {
    return null;
  }
}
