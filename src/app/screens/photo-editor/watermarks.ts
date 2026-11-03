import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pixelmorph/watermarks';

/** RF-020: watermarks kept for any photo. The page owns their shape, so they stay opaque here. */
export interface SavedWatermark {
  id: string;
  name: string;
  layer: unknown;
}

export async function listWatermarks(): Promise<SavedWatermark[]> {
  const json = await AsyncStorage.getItem(KEY);
  return json ? (JSON.parse(json) as SavedWatermark[]) : [];
}

export async function saveWatermark(watermark: SavedWatermark): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify([...(await listWatermarks()), watermark]));
}

export async function deleteWatermark(id: string): Promise<void> {
  const all = await listWatermarks();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((w) => w.id !== id)));
}
