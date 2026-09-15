import { ProjectType, validateProjectType } from '../types/ProjectType';
import { ProjectStatus } from '../types/ProjectStatus';
import { MediaAsset, validateMediaAsset } from './MediaAsset';

/** RF-070: reminder priority for a pending (unfinished) project. */
export type ProjectPriority = 'low' | 'medium' | 'high';

const PROJECT_PRIORITIES: readonly ProjectPriority[] = ['low', 'medium', 'high'];

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  assets: MediaAsset[];
  thumbnailUri?: string;
  /** RF-070: optional deadline used to remind the user about unfinished projects. */
  dueDate?: Date;
  /** RF-070: reminder priority; defaults to 'medium' when a dueDate is set without one. */
  priority?: ProjectPriority;
}

export function createProject(id: string, name: string, type: ProjectType): Project {
  if (!id || typeof id !== 'string') {
    throw new Error('Project: id is required and must be a non-empty string');
  }

  if (!name || typeof name !== 'string') {
    throw new Error('Project: name is required and must be a non-empty string');
  }

  validateProjectType(type);

  const now = new Date();

  return {
    id,
    name,
    type,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    assets: [],
  };
}

export function addAssetToProject(project: Project, asset: MediaAsset): Project {
  if (!validateMediaAsset(asset)) {
    throw new Error('Project.addAsset: Invalid MediaAsset');
  }

  if (project.assets.some((a) => a.id === asset.id)) {
    throw new Error(`Project.addAsset: Asset with id '${asset.id}' already exists in project`);
  }

  return {
    ...project,
    assets: [...project.assets, asset],
    updatedAt: new Date(),
  };
}

export function removeAssetFromProject(project: Project, assetId: string): Project {
  const newAssets = project.assets.filter((a) => a.id !== assetId);

  if (newAssets.length === project.assets.length) {
    throw new Error(`Project.removeAsset: Asset with id '${assetId}' not found`);
  }

  return {
    ...project,
    assets: newAssets,
    updatedAt: new Date(),
  };
}

export function updateProjectAsset(
  project: Project,
  assetId: string,
  updates: Partial<Omit<MediaAsset, 'id' | 'type' | 'originalUri' | 'workingUri' | 'createdAt'>>
): Project {
  const assetIndex = project.assets.findIndex((a) => a.id === assetId);

  if (assetIndex === -1) {
    throw new Error(`Project.updateAsset: Asset with id '${assetId}' not found`);
  }

  const updatedAsset = {
    ...project.assets[assetIndex],
    ...updates,
    id: project.assets[assetIndex].id,
    type: project.assets[assetIndex].type,
    originalUri: project.assets[assetIndex].originalUri,
    workingUri: project.assets[assetIndex].workingUri,
    createdAt: project.assets[assetIndex].createdAt,
    updatedAt: new Date(),
  };

  const newAssets = [...project.assets];
  newAssets[assetIndex] = updatedAsset;

  return {
    ...project,
    assets: newAssets,
    updatedAt: new Date(),
  };
}

export function updateProject(
  project: Project,
  updates: Partial<Omit<Project, 'id' | 'assets' | 'createdAt'>>
): Project {
  if (updates.type && !['photo', 'video', 'mixed'].includes(updates.type)) {
    throw new Error('Project.update: Invalid type');
  }

  if (updates.status && !['active', 'archived'].includes(updates.status)) {
    throw new Error('Project.update: Invalid status');
  }

  if (updates.priority && !PROJECT_PRIORITIES.includes(updates.priority)) {
    throw new Error('Project.update: Invalid priority');
  }

  return {
    ...project,
    ...updates,
    id: project.id,
    assets: project.assets,
    createdAt: project.createdAt,
    updatedAt: new Date(),
  };
}

export function validateProject(project: unknown): project is Project {
  if (typeof project !== 'object' || project === null) return false;

  const p = project as Record<string, unknown>;

  if (typeof p.id !== 'string' || !p.id) return false;
  if (typeof p.name !== 'string' || !p.name) return false;
  if (!['photo', 'video', 'mixed'].includes(p.type as string)) return false;
  if (!['active', 'archived'].includes(p.status as string)) return false;
  if (!(p.createdAt instanceof Date)) return false;
  if (!(p.updatedAt instanceof Date)) return false;
  if (!Array.isArray(p.assets)) return false;
  if (!p.assets.every(validateMediaAsset)) return false;
  if (p.thumbnailUri !== undefined && typeof p.thumbnailUri !== 'string') return false;
  if (p.dueDate !== undefined && !(p.dueDate instanceof Date)) return false;
  if (p.priority !== undefined && !PROJECT_PRIORITIES.includes(p.priority as ProjectPriority)) {
    return false;
  }

  return true;
}
