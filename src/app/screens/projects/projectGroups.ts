import type { Project } from '@modules/projects';

export interface ProjectGroup {
  /** `2026-10` for a month of the current year, `2025` for a whole earlier year. */
  key: string;
  year: number;
  /** 0-11; absent when the group is a whole year. */
  month?: number;
  projects: Project[];
}

export interface GroupedProjects {
  week: Project[];
  groups: ProjectGroup[];
}

const WEEK_DAYS = 7;

/**
 * The projects screen's album view: the last 7 days apart, then one group per month of the
 * current year and one per earlier year, so the screen stays short however many projects exist.
 * Keeps the given order inside each group; groups run from newest to oldest.
 */
export function groupProjects(projects: readonly Project[], now: Date): GroupedProjects {
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WEEK_DAYS - 1));
  const week: Project[] = [];
  const byKey = new Map<string, ProjectGroup>();

  for (const project of projects) {
    const date = project.updatedAt;
    if (date >= weekStart) {
      week.push(project);
      continue;
    }
    const year = date.getFullYear();
    const isThisYear = year === now.getFullYear();
    const key = isThisYear ? `${year}-${String(date.getMonth() + 1).padStart(2, '0')}` : `${year}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, year, month: isThisYear ? date.getMonth() : undefined, projects: [] };
      byKey.set(key, group);
    }
    group.projects.push(project);
  }

  const groups = [...byKey.values()].sort(
    (a, b) => b.year - a.year || (b.month ?? -1) - (a.month ?? -1)
  );
  return { week, groups };
}

/** "Outubro" for a month, "2025" for a year. */
export function groupLabel(group: ProjectGroup, locale: string): string {
  if (group.month === undefined) return String(group.year);
  const name = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    new Date(group.year, group.month, 1)
  );
  return name.charAt(0).toUpperCase() + name.slice(1);
}
