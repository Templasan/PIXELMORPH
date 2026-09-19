/**
 * RF-003: RAW format recognition. There is no sensor-level RAW decoder (Bayer demosaic)
 * available in this Expo-managed, no-custom-native-code build — the requirement's own
 * source notes a specific library was originally cited and the hard dependency was
 * deliberately removed from the functional description. Consistent with that, this
 * module works with a RAW file's embedded full-resolution preview (the same fallback
 * every non-RAW-aware viewer uses), not the raw sensor data itself.
 */

export interface RawFormatInfo {
  extension: string; // lowercase, with leading dot
  label: string; // shown in the UI/project metadata
  mimeType: string; // vendor RAW MIME type, stored on the MediaAsset
}

export const RAW_FORMATS: RawFormatInfo[] = [
  { extension: '.cr3', label: 'Canon CR3', mimeType: 'image/x-canon-cr3' },
  { extension: '.cr2', label: 'Canon CR2', mimeType: 'image/x-canon-cr2' },
  { extension: '.nef', label: 'Nikon NEF', mimeType: 'image/x-nikon-nef' },
  { extension: '.arw', label: 'Sony ARW', mimeType: 'image/x-sony-arw' },
  { extension: '.raf', label: 'Fujifilm RAF', mimeType: 'image/x-fuji-raf' },
  { extension: '.rw2', label: 'Panasonic RW2', mimeType: 'image/x-panasonic-rw2' },
  { extension: '.dng', label: 'Adobe DNG', mimeType: 'image/x-adobe-dng' },
];

const EXTENSION_TO_FORMAT = new Map(RAW_FORMATS.map((f) => [f.extension, f]));
const MIME_TO_FORMAT = new Map(RAW_FORMATS.map((f) => [f.mimeType, f]));

export function isRawFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return RAW_FORMATS.some((f) => lower.endsWith(f.extension));
}

export function rawFormatFromFilename(filename: string): RawFormatInfo | null {
  const lower = filename.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf('.'));
  return EXTENSION_TO_FORMAT.get(ext) ?? null;
}

export function rawFormatFromMimeType(mimeType: string): RawFormatInfo | null {
  return MIME_TO_FORMAT.get(mimeType) ?? null;
}

/** Short label for a RAW MIME type, e.g. for the Projects grid's type badge ("CR3", "NEF"...). */
export function rawFormatLabel(mimeType: string): string | null {
  const info = rawFormatFromMimeType(mimeType);
  return info ? info.label.split(' ').pop()! : null;
}
