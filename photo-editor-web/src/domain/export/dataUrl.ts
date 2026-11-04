/**
 * Bytes a data: URL's base64 payload decodes to. canvas.toDataURL is the only synchronous canvas
 * encoder, so the target-size search (searchQualityForTargetSize takes a sync probe) reads sizes
 * from it.
 */
export function dataUrlBytes(url: string): number {
  const payload = url.slice(url.indexOf(',') + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return (payload.length / 4) * 3 - padding;
}

/**
 * The file a canvas's data URL holds; null when the browser could not encode it ("data:,").
 * Export goes through this, not toBlob: same encoder and same bytes, but toBlob took 4 s where
 * toDataURL took 0.13 s for a 13 MP JPEG, however simple the picture.
 */
export function dataUrlToBlob(url: string): Blob | null {
  const comma = url.indexOf(',');
  if (comma < 0 || comma === url.length - 1) return null;
  const type = url.slice(5, url.indexOf(';'));
  const text = atob(url.slice(comma + 1));
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return new Blob([bytes], { type });
}
