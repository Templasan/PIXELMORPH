import { fillHole } from '../domain/fillHole';
import FillHoleWorker from './fillHole.worker?worker&inline';

/**
 * fillHole on a worker, so the screen keeps moving while it runs (~0.85 s on a phone).
 * The buffers of `rgba` and `hole` move to the worker: pass copies you still need.
 * Inlined because the page runs from file:// in the Android WebView, where a separate worker file is blocked.
 */
export function fillHoleAsync(rgba: Uint8ClampedArray, width: number, height: number, hole: Uint8Array): Promise<Uint8ClampedArray> {
  if (typeof Worker === 'undefined') {
    fillHole(rgba, width, height, hole);
    return Promise.resolve(rgba);
  }
  return new Promise((resolve, reject) => {
    const worker = new FillHoleWorker();
    worker.onmessage = (e: MessageEvent<{ rgba: Uint8ClampedArray }>) => {
      worker.terminate();
      resolve(e.data.rgba);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'fillHole worker failed'));
    };
    worker.postMessage({ rgba, width, height, hole }, { transfer: [rgba.buffer, hole.buffer] });
  });
}
