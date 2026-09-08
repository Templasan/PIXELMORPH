import { ProjectType, ProjectStatus } from '../../domain/types';
import { MediaAssetDTO } from './MediaAssetDTO';

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

  return true;
}
