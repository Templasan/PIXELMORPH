import { ProjectType, ProjectStatus } from '../../domain/types';
import { ProjectPriority } from '../../domain/entities/Project';
import { MediaAssetDTO } from './MediaAssetDTO';

const PROJECT_PRIORITIES: readonly ProjectPriority[] = ['low', 'medium', 'high'];

export interface ProjectPersistenceDTO {
  version: number;
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  assets: MediaAssetDTO[];
  thumbnailUri?: string;
  dueDate?: string;
  priority?: ProjectPriority;
}

export function validateProjectPersistenceDTO(dto: unknown): dto is ProjectPersistenceDTO {
  if (typeof dto !== 'object' || dto === null) return false;

  const d = dto as Record<string, unknown>;

  if (typeof d.version !== 'number' || d.version < 1) return false;
  if (typeof d.id !== 'string' || !d.id) return false;
  if (typeof d.name !== 'string' || !d.name) return false;
  if (!['photo', 'video', 'mixed'].includes(d.type as string)) return false;
  if (!['active', 'archived'].includes(d.status as string)) return false;
  if (typeof d.createdAt !== 'string' || !d.createdAt) return false;
  if (typeof d.updatedAt !== 'string' || !d.updatedAt) return false;
  if (!Array.isArray(d.assets)) return false;
  if (d.thumbnailUri !== undefined && typeof d.thumbnailUri !== 'string') return false;
  if (d.dueDate !== undefined && typeof d.dueDate !== 'string') return false;
  if (d.priority !== undefined && !PROJECT_PRIORITIES.includes(d.priority as ProjectPriority)) {
    return false;
  }

  return true;
}
