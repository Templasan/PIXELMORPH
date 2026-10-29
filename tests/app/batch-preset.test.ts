import { createOperation } from '../../src/core/history';
import { presetStep } from '../../src/app/screens/photo-editor/batchPreset';

describe('presetStep', () => {
  it('records the values the photo has now as the step to undo to', () => {
    const past = [
      createOperation('saturacao', 0, 20),
      createOperation('preset', { exposicao: 0, retroGrain: 0 }, { exposicao: 1, retroGrain: 30 }),
      createOperation('exposicao', 1, 0.5),
    ];
    const step = presetStep(past, { saturacao: -50, exposicao: 2, vibracao: 10 });
    expect(step.type).toBe('preset');
    expect(step.params.from).toEqual({ saturacao: 20, exposicao: 0.5, vibracao: 0 });
    expect(step.params.to).toEqual({ saturacao: -50, exposicao: 2, vibracao: 10 });
  });
});
