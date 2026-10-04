import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPaintLayer } from '../../src/modules/photo-editor/layers/Layer';
import { loadLayers, saveLayers } from '../../src/modules/photo-editor/layers/layerStorage';
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
