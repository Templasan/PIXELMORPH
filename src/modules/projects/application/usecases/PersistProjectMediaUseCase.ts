import type { ProjectRepository, MediaFileStore } from '../../ports';

/**
 * One-time repair for projects created before media was persisted: assets still pointing at a
 * cache file that exists are copied into the permanent store and the project is updated.
 * Files the system already deleted cannot be recovered and are left as they are.
 * Safe to run repeatedly — persisted assets are skipped. Returns how many assets were repaired.
 */
export class PersistProjectMediaUseCase {
  constructor(
    private repository: ProjectRepository,
    private files: MediaFileStore
  ) {}

  async execute(): Promise<number> {
    let moved = 0;
    for (const project of await this.repository.findAll()) {
      let changed = false;
      const assets = [];
      for (const asset of project.assets) {
        const next = { ...asset };
        for (const key of ['originalUri', 'workingUri'] as const) {
          const uri = asset[key];
          if (this.files.isPersisted(uri) || !(await this.files.exists(uri))) continue;
          next[key] =
            key === 'workingUri' && asset.workingUri === asset.originalUri
              ? next.originalUri
              : await this.files.persist(uri, project.id);
        }
        if (next.originalUri !== asset.originalUri || next.workingUri !== asset.workingUri) {
          changed = true;
          moved++;
        }
        assets.push(next);
      }
      if (changed) await this.repository.update({ ...project, assets });
    }
    return moved;
  }
}
