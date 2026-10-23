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
  };
}
