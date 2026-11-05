/**
 * Frame-drop monitor of the web engine. Pure (no RN, DOM or Skia) so Jest can test it and the DOM
 * bundle can import it. The preview tiers themselves are in domain/previewQuality.ts.
 */
/** The web side's status when the System WebView has no WebCodecs (also the fallback trigger). */
export const NEEDS_WEBVIEW = 'O motor de vídeo precisa do Android System WebView atualizado';

export const DROP_WINDOW_MS = 5000;
export const DROP_THRESHOLD = 0.1;
/** Fewer layer draws than this in a window say nothing (paused, idle). */
const MIN_DRAWS = 30;

/** Pure: more than 10 % of the window's layer draws late or dropped. */
export function isSustainedDrop(draws: number, bad: number): boolean {
  return draws >= MIN_DRAWS && bad / draws > DROP_THRESHOLD;
}

/**
 * Feeds one layer draw at a time (`badCount`: that draw showed a late frame, or frames were
 * dropped to catch up). Every 5 s window is judged on its own; returns true when the window just
 * closed with a sustained drop.
 */
export function createDropMonitor(windowMs = DROP_WINDOW_MS) {
  let start = -1;
  let draws = 0;
  let bad = 0;
  return {
    sample(nowMs: number, badCount: number): boolean {
      if (start < 0) start = nowMs;
      draws += 1;
      bad += badCount;
      if (nowMs - start < windowMs) return false;
      const hit = isSustainedDrop(draws, bad);
      start = nowMs;
      draws = 0;
      bad = 0;
      return hit;
    },
    reset() {
      start = -1;
      draws = 0;
      bad = 0;
    },
  };
}
