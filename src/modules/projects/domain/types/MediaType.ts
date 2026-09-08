export type MediaType = 'image' | 'video' | 'audio' | 'unknown';

export function isValidMediaType(value: unknown): value is MediaType {
  return value === 'image' || value === 'video' || value === 'audio' || value === 'unknown';
}

export function validateMediaType(value: unknown): MediaType {
  if (!isValidMediaType(value)) {
    throw new Error(
      `Invalid MediaType: ${value}. Expected 'image', 'video', 'audio', or 'unknown'.`
    );
  }
  return value;
}

export function detectMediaTypeFromMimeType(mimeType: string): MediaType {
  if (!mimeType) return 'unknown';

  const type = mimeType.split('/')[0].toLowerCase();
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';

  return 'unknown';
}
