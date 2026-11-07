// Encodes a picture off the main thread; see encodeCanvas.ts.
self.onmessage = async (e: MessageEvent<{ bitmap: ImageBitmap; type: string; quality?: number }>) => {
  const { bitmap, type, quality } = e.data;
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    bitmap.close();
    self.postMessage({ blob: await canvas.convertToBlob({ type, quality }) });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};
