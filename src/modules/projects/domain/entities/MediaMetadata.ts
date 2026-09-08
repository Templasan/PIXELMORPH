export interface MediaMetadata {
  mimeType: string;
  width?: number;
  height?: number;
  orientation?: number;
  durationMs?: number;
  fileSizeBytes?: number;
}

export function createMediaMetadata(
  mimeType: string,
  partial?: Partial<MediaMetadata>
): MediaMetadata {
  if (!mimeType || typeof mimeType !== 'string') {
    throw new Error('MediaMetadata: mimeType is required and must be a string');
  }

  return {
    mimeType,
    width: partial?.width,
    height: partial?.height,
    orientation: partial?.orientation,
    durationMs: partial?.durationMs,
    fileSizeBytes: partial?.fileSizeBytes,
  };
}

export function validateMediaMetadata(metadata: unknown): metadata is MediaMetadata {
  if (typeof metadata !== 'object' || metadata === null) return false;

  const m = metadata as Record<string, unknown>;

  if (typeof m.mimeType !== 'string' || !m.mimeType) return false;

  if (m.width !== undefined && typeof m.width !== 'number') return false;
  if (m.height !== undefined && typeof m.height !== 'number') return false;
  if (m.orientation !== undefined && typeof m.orientation !== 'number') return false;
  if (m.durationMs !== undefined && typeof m.durationMs !== 'number') return false;
  if (m.fileSizeBytes !== undefined && typeof m.fileSizeBytes !== 'number') return false;

  return true;
}
