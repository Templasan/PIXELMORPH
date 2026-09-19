/**
 * RF-028/RF-058/US-11: real device file access — imports photos/videos from the device's
 * own gallery (expo-image-picker) and saves exported images back to it
 * (expo-media-library + expo-file-system). This is the module every "galeria do
 * dispositivo" limitation noted earlier this session pointed at.
 */

import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';

export interface PickedMedia {
  uri: string;
  width: number;
  height: number;
  type: 'image' | 'video';
  mimeType: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  durationMs: number | null;
}

function toMimeType(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  return asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
}

function toPickedMedia(asset: ImagePicker.ImagePickerAsset): PickedMedia {
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    type: asset.type === 'video' ? 'video' : 'image',
    mimeType: toMimeType(asset),
    fileName: asset.fileName ?? null,
    fileSizeBytes: asset.fileSize ?? null,
    durationMs: asset.duration ?? null,
  };
}

/** Opens the real device gallery picker. `mediaTypes` narrows what the user can pick. */
export async function pickFromGallery(
  mediaTypes: ImagePicker.MediaType[] = ['images', 'videos']
): Promise<PickedMedia | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('PERMISSION_DENIED');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    quality: 1,
    exif: false,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return toPickedMedia(result.assets[0]);
}

export async function pickImageFromGallery(): Promise<PickedMedia | null> {
  return pickFromGallery(['images']);
}

export async function pickVideoFromGallery(): Promise<PickedMedia | null> {
  return pickFromGallery(['videos']);
}

/**
 * RF-057 "Salvar": writes real bytes to a real file (via base64) and adds it to the
 * device's own photo library. Returns the saved asset's local URI.
 */
export async function saveImageToGallery(
  base64: string,
  format: 'JPEG' | 'PNG' | 'WebP'
): Promise<string> {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('PERMISSION_DENIED');
  }

  const extension = format === 'JPEG' ? 'jpg' : format.toLowerCase();
  const tempUri = `${FileSystem.cacheDirectory}pixelmorph_export_${Date.now()}.${extension}`;
  await FileSystem.writeAsStringAsync(tempUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const asset = await MediaLibrary.createAssetAsync(tempUri);
  return asset.uri;
}
