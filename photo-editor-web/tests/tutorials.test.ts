import { initialPhotoEditorState } from '../src/application/photoEditorStore';
import { nextStep, TUTORIALS, tutorialOf } from '../src/application/tutorials';
import { createFocusAdjust, createLocalLayer, createTextLayer } from '../src/domain/layers';

const base = initialPhotoEditorState();

describe('tutorials', () => {
  it('a start parameter picks one, and anything else picks none', () => {
    expect(tutorialOf('tutorial:ajustes')).toBe(TUTORIALS.ajustes);
    expect(tutorialOf('tutorial:nada')).toBeNull();
    expect(tutorialOf('collage')).toBeNull();
    expect(tutorialOf(null)).toBeNull();
  });

  it('none is already done on a fresh photo', () => {
    for (const steps of Object.values(TUTORIALS)) expect(nextStep(steps, 0, base)).toBe(0);
  });

  it('walks the adjustments tutorial as the editor changes', () => {
    const steps = TUTORIALS.ajustes;
    let at = nextStep(steps, 0, { ...base, activeTool: 'ajustes' });
    expect(at).toBe(1);
    at = nextStep(steps, at, { ...base, activeTool: 'ajustes', adjustments: { ...base.adjustments, saturacao: 20 } });
    expect(at).toBe(2);
    at = nextStep(steps, at, { ...base, compareMode: true });
    expect(at).toBe(steps.length);
  });

  it('does not fall back when a done step stops being true', () => {
    expect(nextStep(TUTORIALS.ajustes, 1, { ...base, activeTool: null })).toBe(1);
  });

  it('the layers tutorial wants a text at lower opacity', () => {
    const steps = TUTORIALS.camadas;
    const text = createTextLayer('t', 'oi');
    expect(nextStep(steps, 3, { ...base, layers: [...base.layers, text] })).toBe(3);
    expect(nextStep(steps, 3, { ...base, layers: [...base.layers, { ...text, opacity: 50 }] })).toBe(4);
  });

  it('the masks tutorial wants the focus point moved', () => {
    const steps = TUTORIALS.mascaras;
    const focus = createLocalLayer('f', createFocusAdjust());
    expect(nextStep(steps, 1, { ...base, layers: [...base.layers, focus] })).toBe(2);
    const moved = { ...focus, local: { ...focus.local!, x: 0.3 } };
    expect(nextStep(steps, 2, { ...base, layers: [...base.layers, moved] })).toBe(3);
  });
});
