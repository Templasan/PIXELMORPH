import type { PresetsRepository } from '../../ports/PresetsRepository';

export function createListPresetsUseCase(repo: PresetsRepository) {
  return {
    execute: async () => repo.list(),
  };
}

export function createDeletePresetUseCase(repo: PresetsRepository) {
  return {
    execute: async (id: string) => repo.delete(id),
  };
}
