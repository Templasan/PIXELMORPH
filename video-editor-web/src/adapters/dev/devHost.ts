import type { EditorHost, MediaItem, SavedProject } from '../../ports/host';

const PROJECT_KEY = 'pixelmorph.dev.project';

/**
 * Browser dev host: media/ is the gallery, localStorage the project store, exports go to the dev
 * server's exports/ folder. Served only by `npm run dev` (see mediaPlugin.ts).
 */
export function createDevHost(): EditorHost {
  return {
    async pickMedia(kind) {
      const all = (await (await fetch('/__media/list')).json()) as MediaItem[];
      return all.filter((m) => m.kind === kind);
    },
    async loadProject() {
      try {
        const raw = localStorage.getItem(PROJECT_KEY);
        return raw ? (JSON.parse(raw) as SavedProject) : null;
      } catch {
        return null;
      }
    },
    async saveProject(project) {
      try {
        localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
      } catch {
        // storage full or blocked: the session keeps working, only reload loses it
      }
    },
    exportSink() {
      let name = 'export.mp4';
      let writes = Promise.resolve();
      return {
        async start(fileName) {
          name = fileName;
          await fetch(`/__export?start&name=${encodeURIComponent(name)}`, { method: 'POST' });
        },
        write(position, bytes) {
          const body = bytes.slice();
          writes = writes.then(async () => {
            await fetch(`/__export?name=${encodeURIComponent(name)}&position=${position}`, {
              method: 'POST',
              body,
            });
          });
          return writes;
        },
        async finish() {
          await writes;
          return (await fetch(`/__export?finish&name=${encodeURIComponent(name)}`)).text();
        },
      };
    },
    fileReader: null,
    streamAboveBytes: Infinity,
    close() {
      location.reload();
    },
  };
}
