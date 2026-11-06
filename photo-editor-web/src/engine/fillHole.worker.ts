import { fillHole } from '../domain/fillHole';

// Runs fillHole off the main thread; see fillHoleAsync.ts.
self.onmessage = (e: MessageEvent<{ rgba: Uint8ClampedArray; width: number; height: number; hole: Uint8Array }>) => {
  const { rgba, width, height, hole } = e.data;
  fillHole(rgba, width, height, hole);
  self.postMessage({ rgba }, { transfer: [rgba.buffer] });
};
