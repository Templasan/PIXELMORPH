// The web photo editor's light copy: made once per photo with Skia, upright (EXIF applied, as the
// WebView shows the original), so opening a photo never decodes the full file again.
import * as FileSystem from 'expo-file-system/legacy';
import { FilterMode, MipmapMode, Skia } from '@shopify/react-native-skia';
import { encodeImage } from '@modules/export';
import { readExifOrientation } from '@modules/photo-editor';
import { fitLongEdgeOf, PREVIEW_LONG_EDGE } from './resolution';
import { loadFullImage } from './photoProxySkia';

export interface LightCopy {
  uri: string;
  /** The original's upright size. */
  width: number;
  height: number;
}

/**
 * Stored pixel (x, y) of a W×H image -> where it shows, for each EXIF orientation, as a 2D affine
 * [a, b, c, d, e, f] (x' = ax + by + c, y' = dx + ey + f).
 */
function orientationMatrix(o: number, w: number, h: number): number[] {
  switch (o) {
    case 2:
      return [-1, 0, w, 0, 1, 0];
    case 3:
      return [-1, 0, w, 0, -1, h];
    case 4:
      return [1, 0, 0, 0, -1, h];
    case 5:
      return [0, 1, 0, 1, 0, 0];
    case 6:
      return [0, -1, h, 1, 0, 0];
    case 7:
      return [0, -1, h, -1, 0, w];
    case 8:
      return [0, 1, 0, -1, 0, w];
    default:
      return [1, 0, 0, 0, 1, 0];
  }
}

/** `<name>.light.jpg` next to `uri` (+ `.json` with the original's size), made once. */
export async function orientedLightCopyOf(uri: string): Promise<LightCopy> {
  const base = uri.replace(/\.[^./]+$/, '');
  const copy = `${base}.light.jpg`;
  const meta = `${base}.light.json`;
  if (
    (await FileSystem.getInfoAsync(copy)).exists &&
    (await FileSystem.getInfoAsync(meta)).exists
  ) {
    const size = JSON.parse(await FileSystem.readAsStringAsync(meta)) as Omit<LightCopy, 'uri'>;
    return { uri: copy, ...size };
  }
  const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
  const orientation = readExifOrientation(bytes);
  const image = await loadFullImage(uri);
  if (!image) throw new Error('Não foi possível abrir esta foto.');
  try {
    const w = image.width();
    const h = image.height();
    const turned = orientation >= 5;
    const width = turned ? h : w;
    const height = turned ? w : h;
    const out = fitLongEdgeOf(width, height, PREVIEW_LONG_EDGE);
    const surface = Skia.Surface.Make(out.width, out.height);
    if (!surface) throw new Error('Sem memória para a cópia leve.');
    const canvas = surface.getCanvas();
    canvas.scale(out.width / width, out.height / height);
    const [a, b, c, d, e, f] = orientationMatrix(orientation, w, h);
    canvas.concat([a, b, c, d, e, f, 0, 0, 1]);
    canvas.drawImageRectOptions(
      image,
      Skia.XYWHRect(0, 0, w, h),
      Skia.XYWHRect(0, 0, w, h),
      FilterMode.Linear,
      MipmapMode.Linear
    );
    surface.flush();
    const light = surface.makeImageSnapshot();
    const { base64 } = encodeImage(light, 'JPEG', 90);
    light.dispose();
    // Written under a temporary name and moved: a killed app never leaves a half file.
    await FileSystem.writeAsStringAsync(`${copy}.tmp`, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(meta, JSON.stringify({ width, height }));
    await FileSystem.moveAsync({ from: `${copy}.tmp`, to: copy });
    return { uri: copy, width, height };
  } finally {
    image.dispose();
  }
}
