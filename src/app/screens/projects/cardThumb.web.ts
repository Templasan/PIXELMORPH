import { createStore } from '@core/state';
import type { Project } from '@modules/projects';

// Web design preview only (docs/web-preview.md): the sample photo itself is the thumbnail.
export type MakeCardThumb = (sourceUri: string, tmpUri: string) => Promise<void>;
export type CardThumbStatus = 'pending' | 'ready' | 'failed';
export const cardThumbStore = createStore<Record<string, CardThumbStatus>>({});
export const CARD_THUMB_TIMEOUT_MS = 20_000;

export function cardThumbSourceOf(project: Project): string | null {
  const asset = project.assets[0];
  return asset?.type === 'image' ? asset.workingUri : null;
}

export const cardThumbPathOf = cardThumbSourceOf;
export const requestCardThumb = async (): Promise<void> => {};
export const retryFailedCardThumbs = (): void => {};
export const useCardThumb = (project: Project, _make: MakeCardThumb): string | null =>
  cardThumbSourceOf(project);
