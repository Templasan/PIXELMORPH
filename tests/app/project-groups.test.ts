import { groupLabel, groupProjects } from '../../src/app/screens/projects/projectGroups';
import type { Project } from '../../src/modules/projects';

const project = (id: string, updatedAt: Date) => ({ id, updatedAt }) as Project;
const ids = (projects: Project[]) => projects.map((p) => p.id);
const NOW = new Date(2026, 10, 2, 15, 0);

describe('groupProjects', () => {
  it('keeps the last 7 days, counting whole days, apart from the months', () => {
    const { week, groups } = groupProjects(
      [
        project('today', new Date(2026, 10, 2, 8)),
        project('sixDaysAgo', new Date(2026, 9, 27, 0, 0)),
        project('sevenDaysAgo', new Date(2026, 9, 26, 23, 59)),
      ],
      NOW
    );
    expect(ids(week)).toEqual(['today', 'sixDaysAgo']);
    expect(groups.map((g) => g.key)).toEqual(['2026-10']);
    expect(ids(groups[0].projects)).toEqual(['sevenDaysAgo']);
  });

  it('gives each month of this year and each earlier year one group, newest first', () => {
    const { groups } = groupProjects(
      [
        project('2024', new Date(2024, 5, 1)),
        project('jan', new Date(2026, 0, 15)),
        project('2025a', new Date(2025, 11, 31)),
        project('sep', new Date(2026, 8, 1)),
        project('2025b', new Date(2025, 0, 1)),
      ],
      NOW
    );
    expect(groups.map((g) => g.key)).toEqual(['2026-09', '2026-01', '2025', '2024']);
    expect(ids(groups[2].projects)).toEqual(['2025a', '2025b']);
  });

  it('copes with no projects', () => {
    expect(groupProjects([], NOW)).toEqual({ week: [], groups: [] });
  });
});

describe('groupLabel', () => {
  it('names a month with a capital letter and a year by its number', () => {
    expect(groupLabel({ key: '2026-10', year: 2026, month: 9, projects: [] }, 'en')).toBe(
      'October'
    );
    expect(groupLabel({ key: '2025', year: 2025, projects: [] }, 'en')).toBe('2025');
  });
});
