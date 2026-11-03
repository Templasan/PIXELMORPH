import { DEFAULT_ADJUSTMENTS } from '../domain/adjustments';
import { isFixedLayer } from '../domain/layers';
import type { PhotoEditorState } from './photoEditorStore';

/** RF-056: one thing to do in the editor; the step is over when the editor shows it was done. */
export interface TutorialStep {
  text: string;
  done: (state: PhotoEditorState) => boolean;
}

export const TUTORIALS: Record<string, TutorialStep[]> = {
  ajustes: [
    { text: 'Toque em Ajustes, na barra de baixo.', done: (s) => s.activeTool === 'ajustes' },
    {
      text: 'Arraste um controle para mudar a foto.',
      done: (s) => Object.keys(DEFAULT_ADJUSTMENTS).some((k) => s.adjustments[k] !== DEFAULT_ADJUSTMENTS[k]),
    },
    { text: 'Toque em Comparar, no alto (< >), para ver antes e depois.', done: (s) => s.compareMode },
  ],
  camadas: [
    { text: 'Toque em Elementos, na barra de baixo.', done: (s) => s.activeTool === 'elementos' },
    { text: 'Digite um texto e toque em Adicionar ao canvas.', done: (s) => s.layers.some((l) => l.text) },
    { text: 'Agora toque em Camadas.', done: (s) => s.activeTool === 'camadas' },
    {
      text: 'Com o texto selecionado, baixe a Opacidade.',
      done: (s) => s.layers.some((l) => !isFixedLayer(l) && l.text && l.opacity < 100),
    },
  ],
  mascaras: [
    { text: 'Toque em Máscaras, na barra de baixo.', done: (s) => s.activeTool === 'mascaras' },
    { text: 'Toque em + Foco para desfocar o fundo.', done: (s) => s.layers.some((l) => l.local) },
    {
      text: 'Arraste o ponto na foto até o que deve ficar nítido.',
      done: (s) => s.layers.some((l) => l.local && (l.local.x !== 0.5 || l.local.y !== 0.5)),
    },
  ],
};

/** The tutorial a start parameter asks for, like `tutorial:ajustes`; null for anything else. */
export function tutorialOf(start: string | null | undefined): TutorialStep[] | null {
  return start?.startsWith('tutorial:') ? (TUTORIALS[start.slice('tutorial:'.length)] ?? null) : null;
}

/** The step after `current` once the editor shows it is done. A finished step never comes back. */
export function nextStep(steps: readonly TutorialStep[], current: number, state: PhotoEditorState): number {
  let at = current;
  while (at < steps.length && steps[at].done(state)) at += 1;
  return at;
}
