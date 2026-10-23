import type { EditorSession } from '../../application/session';
import { defaultTracks } from '../../application/session';
import { setTransition, type TransitionType } from '../../domain/transitions';
import type { MediaItem } from '../../ports/host';

/**
 * Dev-only helpers for checking the editor from the browser console (`T.…`): build a timeline
 * from media/ files, add transitions, save preview snapshots to exports/ for review.
 */
export function createTestKit(pm: EditorSession) {
  let list: MediaItem[] = [];
  const by = (prefix: string) => {
    const m = list.find((x) => x.name.startsWith(prefix));
    if (!m) throw new Error(`no media starting with ${prefix}`);
    return m;
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return {
    async load() {
      list = await (await fetch('/__media/list')).json();
      return list.map((m) => m.name);
    },
    reset() {
      pm.pause();
      pm.editor.commit(() => defaultTracks());
      pm.editor.clearSelection();
      pm.seek(0);
    },
    async add(...prefixes: string[]) {
      for (const p of prefixes) await pm.addMedia(by(p));
      return pm.error.get();
    },
    transitions(type: TransitionType = 'slide', durationMs = 600, trackId = 'v1') {
      const track = pm.editor.store.get().tracks.find((t) => t.id === trackId)!;
      for (const c of track.clips.slice(1)) {
        pm.editor.commit((t) => setTransition(t, trackId, c.id, { type, durationMs }));
      }
    },
    clips(trackId = 'v1') {
      const track = pm.editor.store.get().tracks.find((t) => t.id === trackId)!;
      return [...track.clips]
        .sort((a, b) => a.startMs - b.startMs)
        .map((c) => ({
          id: c.id,
          name: c.name.slice(0, 3),
          start: c.startMs,
          end: c.startMs + (c.outPointMs - c.inPointMs) / (c.speed ?? 1),
        }));
    },
    /** Saves the preview at `ms` as exports/<name>.png (after the still frame is drawn). */
    async snap(name: string, ms: number) {
      pm.seek(ms);
      await sleep(700);
      const canvas = document.querySelector<HTMLCanvasElement>('.preview canvas')!;
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
      const sink = pm.host.exportSink();
      await sink.start(`${name}.png`);
      await sink.write(0, new Uint8Array(await blob.arrayBuffer()));
      await sink.finish();
      return name;
    },
    sleep,

    /**
     * Plays `seconds` from `fromMs` and summarises where the main thread went: per-frame costs
     * (p50/p95/max), real frame rate, late layers, long tasks (> 50 ms), JS heap, open decoders.
     * The browser pane must be visible (requestAnimationFrame).
     */
    async measure(fromMs: number, seconds: number) {
      const longTasks: number[] = [];
      const obs =
        typeof PerformanceObserver !== 'undefined' &&
        PerformanceObserver.supportedEntryTypes?.includes('longtask')
          ? new PerformanceObserver((l) => l.getEntries().forEach((e) => longTasks.push(e.duration)))
          : null;
      obs?.observe({ type: 'longtask', buffered: false });
      const heap = () =>
        (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
      pm.pause();
      pm.seek(fromMs);
      await sleep(800);
      const heap0 = heap();
      pm.startTrace();
      const w0 = performance.now();
      pm.play();
      await sleep(seconds * 1000);
      pm.pause();
      const wall = performance.now() - w0;
      const tr = pm.stopTrace();
      obs?.disconnect();
      const pct = (xs: number[], q: number) => {
        const s = [...xs].sort((x, y) => x - y);
        return +(s[Math.min(s.length - 1, Math.floor(s.length * q))] ?? 0).toFixed(2);
      };
      const sum = (key: 'planMs' | 'decodeMs' | 'drawMs' | 'intervalMs') => {
        const xs = tr.map((f) => f[key]).filter((x) => x > 0);
        return { p50: pct(xs, 0.5), p95: pct(xs, 0.95), max: pct(xs, 1) };
      };
      return {
        frames: tr.length,
        fps: +((tr.length / wall) * 1000).toFixed(1),
        lateFrames: tr.filter((f) => f.late.length).length,
        heldFrames: tr.filter((f) => f.held).length,
        interval: sum('intervalMs'),
        plan: sum('planMs'),
        decode: sum('decodeMs'),
        draw: sum('drawMs'),
        longTasks: { count: longTasks.length, maxMs: Math.round(Math.max(0, ...longTasks)) },
        maxFeeds: Math.max(0, ...tr.map((f) => f.feeds)),
        maxInputs: Math.max(0, ...tr.map((f) => f.inputs)),
        heapMB: { start: +(heap0 / 1e6).toFixed(1), end: +(heap() / 1e6).toFixed(1) },
      };
    },

    /** `n` seeks to fixed pseudo-random instants, paused: time until each exact frame is drawn. */
    async seekBench(n = 20) {
      pm.pause();
      let seed = 3;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const lat: number[] = [];
      for (let i = 0; i < n; i += 1) {
        const t0 = performance.now();
        await pm.seekAndWait(rnd() * pm.durationMs());
        lat.push(performance.now() - t0);
      }
      lat.sort((a, b) => a - b);
      return { n, p50: Math.round(lat[n >> 1]), p95: Math.round(lat[Math.floor(n * 0.95)] ?? 0), max: Math.round(lat[n - 1]) };
    },
  };
}
