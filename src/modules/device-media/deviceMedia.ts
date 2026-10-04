/**
 * RF-028/RF-058/US-11: real device file access — imports photos/videos from the device's
 * own gallery (expo-image-picker) and saves exported images back to it
 * (expo-media-library + expo-file-system). This is the module every "galeria do
 * dispositivo" limitation noted earlier this session pointed at.
 */

import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { createVideoPlayer } from 'expo-video';
import { IMPORTS_DIR_NAME } from '@core/reliability/storageUsage';

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

/** RF-023: multi-select photo pick — the source sequence for a time-lapse. */
export async function pickMultipleImagesFromGallery(): Promise<PickedMedia[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('PERMISSION_DENIED');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
    allowsMultipleSelection: true,
  });

  if (result.canceled) return [];
  return result.assets.map(toPickedMedia);
}

export interface PickedAudio {
  uri: string;
  fileName: string;
  fileSizeBytes: number | null;
  mimeType: string;
}

/**
 * RF-036: a real audio file (music, narration) for a background track — expo-image-picker
 * has no audio mode, so this uses the OS document/file picker (Storage Access Framework on
 * Android) instead, same as any "attach a file" flow.
 */
export async function pickAudioFromDevice(): Promise<PickedAudio | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.name,
    fileSizeBytes: asset.size ?? null,
    mimeType: asset.mimeType ?? 'audio/mpeg',
  };
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

/**
 * RF-011: writes composed bytes (e.g. a collage) to the app's own cache — a real local
 * file:// URI usable as a project's MediaAsset, same cache dir the image picker already
 * uses. Not added to the device gallery; that's what "Salvar na galeria" is for.
 */
export async function writeImageToCache(
  base64: string,
  format: 'JPEG' | 'PNG' | 'WebP'
): Promise<string> {
  const extension = format === 'JPEG' ? 'jpg' : format.toLowerCase();
  const uri = `${FileSystem.cacheDirectory}pixelmorph_collage_${Date.now()}.${extension}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

/**
 * RF-037: size/dimensions for a file that didn't come through the gallery picker (camera,
 * RAW import), so the properties panel isn't blank. Best-effort — missing fields stay undefined.
 */
export async function probeFileMetadata(
  uri: string,
  kind: 'image' | 'video'
): Promise<{ width?: number; height?: number; fileSizeBytes?: number }> {
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  const fileSizeBytes = info && info.exists ? info.size : undefined;
  if (kind === 'video') return { fileSizeBytes };
  const dims = await new Promise<{ width: number; height: number } | null>((resolve) =>
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    )
  );
  return { fileSizeBytes, ...dims };
}

/**
 * Copies a file the user picked (the picker's cache copy can be cleared at any time) into the
 * app's permanent folder, so effects that reference it keep working after "Limpar cache".
 */
export async function copyToAppStorage(uri: string, fileName?: string | null): Promise<string> {
  const dir = `${FileSystem.documentDirectory}${IMPORTS_DIR_NAME}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const extension = (fileName ?? uri).match(/\.(\w{2,5})$/)?.[1] ?? 'jpg';
  const destination = `${dir}${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

/**
 * Real duration of a video file, read by actually loading it in a player. The gallery picker
 * reports 0 or nothing for some videos (e.g. screen recordings), and the editor sized the clip
 * from that, so such a clip came out empty. Resolves to undefined if it can't be read in time.
 */
export function probeVideoDurationMs(uri: string, timeoutMs = 8000): Promise<number | undefined> {
  return new Promise((resolve) => {
    const player = createVideoPlayer(uri);
    let done = false;
    const finish = (ms: number | undefined) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      subscription.remove();
      player.release();
      resolve(ms);
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        finish(player.duration > 0 ? Math.round(player.duration * 1000) : undefined);
      } else if (status === 'error') {
        finish(undefined);
      }
    });
  });
}
