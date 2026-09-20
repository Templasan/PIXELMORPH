import type { PresetsRepository } from '@core/ports/PresetsRepository';

export function createListPresetsUseCase(repo: PresetsRepository) {
  return {
    execute: async () => repo.list(),
  };
}
