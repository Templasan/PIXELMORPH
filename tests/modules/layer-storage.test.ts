import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPaintLayer } from '../../src/modules/photo-editor/layers/Layer';
import {
  loadEditorImages,
  loadLayers,
  saveEditorImages,
  saveLayers,
} from '../../src/modules/photo-editor/layers/layerStorage';
import type { EditorLayer } from '../../src/modules/photo-editor/layers/Layer';

const background: EditorLayer = {
  id: 'fundo',
  name: 'Fundo',
  kind: 'background',
  visible: true,
  opacity: 100,
  locked: true,
};

describe('layer storage (US-08 persistence)', () => {
  beforeEach(() => AsyncStorage.clear());

  it('returns null for a project that never saved layers', async () => {
    expect(await loadLayers('p1')).toBeNull();
  });

  it('round-trips layers with their strokes, visibility and opacity', async () => {
    const paint = createPaintLayer('Pintura 1');
    paint.strokes = [{ id: 's1', path: 'M0,0 L10,10', color: '#E5484D', width: 8, opacity: 1 }];
    paint.opacity = 60;
    paint.visible = false;

    await saveLayers('p1', [background, paint]);
    const loaded = await loadLayers('p1');

    expect(loaded).toEqual([background, paint]);
  });

  it('keeps each project separate', async () => {
    await saveLayers('p1', [background]);
    expect(await loadLayers('p2')).toBeNull();
  });

  it('ignores corrupted or incomplete data instead of crashing', async () => {
    await AsyncStorage.setItem('layers:p1', '{not json');
    expect(await loadLayers('p1')).toBeNull();

    await AsyncStorage.setItem('layers:p1', JSON.stringify([{ id: 'x', kind: 'paint' }]));
    expect(await loadLayers('p1')).toBeNull(); // no background layer
  });
});

describe('editor image storage (RF-075 / RF-028)', () => {
  beforeEach(() => AsyncStorage.clear());

  it('round-trips the double-exposure and overlay images of a project', async () => {
    const images = {
      doubleExposure: { name: 'praia.jpg', uri: 'file:///docs/imports/1.jpg' },
      overlay: { name: 'poeira.png', uri: 'file:///docs/imports/2.png' },
    };
    await saveEditorImages('p1', images);
    expect(await loadEditorImages('p1')).toEqual(images);
    expect(await loadEditorImages('p2')).toBeNull();
  });

  it('drops entries that are not valid images and survives corrupted data', async () => {
    await AsyncStorage.setItem(
      'editorImages:p1',
      JSON.stringify({ doubleExposure: { name: 'sem uri' }, overlay: null })
    );
    expect(await loadEditorImages('p1')).toEqual({ doubleExposure: null, overlay: null });

    await AsyncStorage.setItem('editorImages:p1', '{not json');
    expect(await loadEditorImages('p1')).toBeNull();
  });
});
