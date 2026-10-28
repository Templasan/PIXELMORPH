/** Reads `uri` (XHR: fetch() cannot read file:// pages' files in the app's WebView). */
export function fetchBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', uri);
    x.responseType = 'blob';
    x.onload = () =>
      (x.status === 0 || x.status === 200) && x.response
        ? resolve(x.response as Blob)
        : reject(new Error(`could not read ${uri} (status ${x.status})`));
    x.onerror = () => reject(new Error(`could not read ${uri}`));
    x.send();
  });
}

/**
 * A picture decoded upright (EXIF orientation applied), its long edge at most `maxLongEdge`;
 * `width`/`height` are the file's own.
 */
export async function loadPicture(
  uri: string,
  maxLongEdge: number
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const blob = await fetchBlob(uri);
  const full = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const long = Math.max(full.width, full.height);
  const own = { width: full.width, height: full.height };
  if (long <= maxLongEdge) return { bitmap: full, ...own };
  const k = maxLongEdge / long;
  const small = await createImageBitmap(full, {
    resizeWidth: Math.round(full.width * k),
    resizeHeight: Math.round(full.height * k),
    resizeQuality: 'high',
  });
  full.close();
  return { bitmap: small, ...own };
}
