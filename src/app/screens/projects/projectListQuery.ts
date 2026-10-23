import type { Project } from '@modules/projects';

export type ProjectSort = 'recent' | 'name' | 'oldest';

export const PROJECT_SORT_ORDER: readonly ProjectSort[] = ['recent', 'name', 'oldest'];

/** Lower-case and strip combining accents so "Edição" matches "edicao". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

/** Filters by name (accent- and case-insensitive) and sorts a copy of the list. */
export function queryProjects(projects: Project[], query: string, sort: ProjectSort): Project[] {
  const needle = normalizeForSearch(query.trim());
  const matching = needle
    ? projects.filter((p) => normalizeForSearch(p.name).includes(needle))
    : projects.slice();

  switch (sort) {
    case 'name':
      return matching.sort((a, b) =>
        normalizeForSearch(a.name).localeCompare(normalizeForSearch(b.name))
      );
    case 'oldest':
      return matching.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    case 'recent':
      return matching.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}
