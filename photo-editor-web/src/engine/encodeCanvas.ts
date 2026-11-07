import EncodeWorker from './encode.worker?worker&inline';

/**
 * `canvas` as a file of `type`, encoded on a worker. The main thread's toBlob encodes JPEG and PNG
 * only in idle time: with an animation on screen (the busy spinner) a 1080×2400 PNG took 6.4 s on
 * the Poco instead of 0.1 s; on a worker it took 0.1 s either way.
 */
export async function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return new Promise((r) => canvas.toBlob(r, type, quality));
  }
  const bitmap = await createImageBitmap(canvas);
  const worker = new EncodeWorker();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<{ blob?: Blob; error?: string }>) =>
        e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.blob ?? null);
      worker.onerror = (e) => reject(new Error(e.message || 'encode worker failed'));
      worker.postMessage({ bitmap, type, quality }, [bitmap]);
    });
  } finally {
    worker.terminate();
  }
}
