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
