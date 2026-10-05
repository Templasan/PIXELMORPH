import type { PresetsRepository } from '../../ports/PresetsRepository';

export function createListPresetsUseCase(repo: PresetsRepository) {
  return {
    execute: async () => repo.list(),
  };
}
