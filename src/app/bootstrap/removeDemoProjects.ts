import type { ProjectsModule } from '@modules/projects';

const DEMO_HOST = 'https://images.unsplash.com/';

/**
 * Earlier builds seeded fake projects (stock photos posing as videos) on first run. Real
 * projects always point at a file on the device, so a project whose media is a remote
 * stock URL is leftover demo data and is removed.
 */
export async function removeDemoProjects(module: ProjectsModule): Promise<void> {
  const all = await module.listProjects.execute();
  for (const project of all) {
    const isDemo =
      project.assets.length > 0 && project.assets.every((a) => a.originalUri.startsWith(DEMO_HOST));
    if (isDemo) await module.deleteProject.execute(project.id);
  }
}
