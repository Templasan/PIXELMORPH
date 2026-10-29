import type { EditorHost, PictureRef, PresetRef, SavedPhoto } from '../../ports/host';

const PRESETS_KEY = 'pixelmorph.dev.presets';

interface Listed extends PictureRef {
  kind: string | null;
}

async function pictures(): Promise<PictureRef[]> {
  const all = (await (await fetch('/__media/list')).json()) as Listed[];
  return all.filter((m) => m.kind === 'image');
}

/**
 * Browser dev host: media/ is the gallery, localStorage the project store, exports go to the dev
 * server's exports/ folder. `?photo=<file in media/>` picks the photo (default: the first one);
 * each photo keeps its own project. Served only by `npm run dev` (see mediaPlugin.ts).
 */
export function createDevHost(): EditorHost {
  const wanted = new URLSearchParams(location.search).get('photo');
  let key = '';
  return {
    async loadProject() {
      const all = await pictures();
      const photo = all.find((p) => p.name === wanted) ?? all[0];
      if (!photo) return null;
      key = `pixelmorph.dev.photo.${photo.name}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as SavedPhoto;
      } catch {
        // blocked storage: start fresh
      }
      return { name: photo.name, photo };
    },
    async saveProject(project) {
      try {
        localStorage.setItem(key, JSON.stringify(project));
      } catch {
        // storage full or blocked: the session keeps working, only reload loses it
      }
    },
    async pickPicture() {
      const all = await pictures();
      const answer = prompt(all.map((p, i) => `${i + 1}. ${p.name}`).join('\n'), '1');
      return answer ? (all[Number(answer) - 1] ?? null) : null;
    },
    async listPresets() {
      try {
        return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') as PresetRef[];
      } catch {
        return [];
      }
    },
    async savePreset(name, adjustments) {
      const all = await this.listPresets();
      localStorage.setItem(PRESETS_KEY, JSON.stringify([...all, { id: `preset_${Date.now()}`, name, adjustments }]));
    },
    newProject() {
      const sink = this.exportSink();
      return {
        start: (fileName) => sink.start(`new/${fileName}`),
        write: (position, bytes) => sink.write(position, bytes),
        async finish() {
          console.info('new project file:', await sink.finish());
        },
      };
    },
    photoSink() {
      const sink = this.exportSink();
      let name = '';
      return {
        start(fileName) {
          name = `baked/${fileName}`;
          return sink.start(name);
        },
        write: (position, bytes) => sink.write(position, bytes),
        async finish() {
          await sink.finish();
          return { photo: { name, uri: `/exports/${name}` } };
        },
      };
    },
    exportSink() {
      let name = 'export.jpg';
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
    close() {
      location.reload();
    },
  };
}
