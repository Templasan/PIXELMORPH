import { MediaType } from '../../domain/types';
import { MediaMetadata } from '../../domain/entities';

export interface MediaAssetDTO {
  id: string;
  type: MediaType;
  originalUri: string;
  workingUri: string;
  metadata: MediaMetadata;
  createdAt: string;
  updatedAt: string;
}

export function validateMediaAssetDTO(dto: unknown): dto is MediaAssetDTO {
  if (typeof dto !== 'object' || dto === null) return false;

  const d = dto as Record<string, unknown>;

  if (typeof d.id !== 'string' || !d.id) return false;
  if (!['image', 'video', 'audio', 'unknown'].includes(d.type as string)) return false;
  if (typeof d.originalUri !== 'string' || !d.originalUri) return false;
  if (typeof d.workingUri !== 'string' || !d.workingUri) return false;
  if (typeof d.metadata !== 'object' || d.metadata === null) return false;
  if (typeof d.createdAt !== 'string' || !d.createdAt) return false;
  if (typeof d.updatedAt !== 'string' || !d.updatedAt) return false;

  return true;
}
