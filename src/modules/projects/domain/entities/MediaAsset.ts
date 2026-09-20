import { MediaType, validateMediaType } from '../types/MediaType';
import { MediaMetadata, validateMediaMetadata } from './MediaMetadata';

export interface MediaAsset {
  id: string;
  type: MediaType;
  originalUri: string;
  workingUri: string;
  metadata: MediaMetadata;
  createdAt: Date;
  updatedAt: Date;
  adjustments?: Record<string, number>;
}

export function createMediaAsset(
  id: string,
  type: MediaType,
  originalUri: string,
  workingUri: string,
  metadata: MediaMetadata
): MediaAsset {
  if (!id || typeof id !== 'string') {
    throw new Error('MediaAsset: id is required and must be a non-empty string');
  }

  validateMediaType(type);

  if (!originalUri || typeof originalUri !== 'string') {
    throw new Error('MediaAsset: originalUri is required and must be a non-empty string');
  }

  if (!workingUri || typeof workingUri !== 'string') {
    throw new Error('MediaAsset: workingUri is required and must be a non-empty string');
  }

  if (!validateMediaMetadata(metadata)) {
    throw new Error('MediaAsset: metadata is invalid');
  }

  const now = new Date();

  return {
    id,
    type,
    originalUri,
    workingUri,
    metadata,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateMediaAsset(
  asset: MediaAsset,
  updates: Partial<Omit<MediaAsset, 'id' | 'type' | 'originalUri' | 'workingUri' | 'createdAt'>>
): MediaAsset {
  return {
    ...asset,
    ...updates,
    id: asset.id,
    type: asset.type,
    originalUri: asset.originalUri,
    workingUri: asset.workingUri,
    createdAt: asset.createdAt,
    updatedAt: new Date(),
  };
}

export function validateMediaAsset(asset: unknown): asset is MediaAsset {
  if (typeof asset !== 'object' || asset === null) return false;

  const a = asset as Record<string, unknown>;

  if (typeof a.id !== 'string' || !a.id) return false;
  if (!['image', 'video', 'audio', 'unknown'].includes(a.type as string)) return false;
  if (typeof a.originalUri !== 'string' || !a.originalUri) return false;
  if (typeof a.workingUri !== 'string' || !a.workingUri) return false;
  if (!validateMediaMetadata(a.metadata)) return false;
  if (!(a.createdAt instanceof Date)) return false;
  if (!(a.updatedAt instanceof Date)) return false;
  if (a.adjustments !== undefined && (typeof a.adjustments !== 'object' || a.adjustments === null))
    return false;

  return true;
}
