import type { Project } from '@modules/projects';
import { normalizeForSearch, queryProjects } from '@app/screens/projects/projectListQuery';

function project(id: string, name: string, createdDay: number, updatedDay: number): Project {
  return {
    id,
    name,
    type: 'photo',
    status: 'active',
    createdAt: new Date(2026, 0, createdDay),
    updatedAt: new Date(2026, 0, updatedDay),
    assets: [],
  };
}

const projects = [
  project('a', 'Praia', 3, 5),
  project('b', 'Edição final', 1, 2),
  project('c', 'banana', 2, 9),
];

const ids = (list: Project[]) => list.map((p) => p.id);

describe('normalizeForSearch', () => {
  it('strips accents and lower-cases', () => {
    expect(normalizeForSearch('Edição')).toBe('edicao');
    expect(normalizeForSearch('ÁGUA')).toBe('agua');
  });
});

describe('queryProjects', () => {
  it('matches the name ignoring case and accents', () => {
    expect(ids(queryProjects(projects, 'edicao', 'recent'))).toEqual(['b']);
    expect(ids(queryProjects(projects, '  PRAI ', 'recent'))).toEqual(['a']);
  });

  it('returns everything for an empty query', () => {
    expect(queryProjects(projects, '   ', 'name')).toHaveLength(3);
  });

  it('sorts by most recently updated by default', () => {
    expect(ids(queryProjects(projects, '', 'recent'))).toEqual(['c', 'a', 'b']);
  });

  it('sorts by name A-Z ignoring case and accents', () => {
    expect(ids(queryProjects(projects, '', 'name'))).toEqual(['c', 'b', 'a']);
  });

  it('sorts oldest first by creation date', () => {
    expect(ids(queryProjects(projects, '', 'oldest'))).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const copy = [...projects];
    queryProjects(projects, 'a', 'name');
    expect(projects).toEqual(copy);
  });
});
