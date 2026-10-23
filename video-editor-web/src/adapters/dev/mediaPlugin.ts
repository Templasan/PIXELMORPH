import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Dev server only (never in the app build): serves the local `media/` folder as the "device
 * gallery" and receives exports into `exports/`, so the editor can be used and checked from a
 * desktop browser. The app supplies the same things through its own host adapter.
 */
export function devMediaPlugin(): Plugin {
  const root = process.cwd();
  const mediaDir = path.join(root, 'media');
  const exportDir = path.join(root, 'exports');
  const kindOf = (name: string) =>
    /\.(mp4|mov|webm|m4v)$/i.test(name)
      ? 'video'
      : /\.(jpe?g|png|webp|gif|heic)$/i.test(name)
        ? 'image'
        : /\.(m4a|mp3|wav|aac|ogg)$/i.test(name)
          ? 'audio'
          : null;
  return {
    name: 'pixelmorph-dev-media',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__media/list', (_req, res) => {
        const files = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir) : [];
        const items = files
          .map((name) => ({ name, kind: kindOf(name), uri: `/media/${encodeURIComponent(name)}` }))
          .filter((m) => m.kind);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(items));
      });
      server.middlewares.use('/media/', (req, res, next) => {
        const name = decodeURIComponent((req.url ?? '').split('?')[0].replace(/^\//, ''));
        const file = path.join(mediaDir, name);
        if (!file.startsWith(mediaDir) || !fs.existsSync(file)) return next();
        res.setHeader('Content-Length', fs.statSync(file).size);
        fs.createReadStream(file).pipe(res);
      });
      // Export chunks arrive in order: ?start (truncate) then appended bodies, ?finish returns the path.
      server.middlewares.use('/__export', (req, res) => {
        const url = new URL(req.url ?? '', 'http://dev');
        fs.mkdirSync(exportDir, { recursive: true });
        const name = path.basename(url.searchParams.get('name') ?? 'export.mp4');
        const file = path.join(exportDir, name);
        if (url.searchParams.has('start')) {
          fs.writeFileSync(file, '');
          res.end('ok');
          return;
        }
        if (url.searchParams.has('finish')) {
          res.end(file);
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const position = Number(url.searchParams.get('position') ?? 0);
          const fd = fs.openSync(file, 'r+');
          const body = Buffer.concat(chunks);
          fs.writeSync(fd, body, 0, body.length, position);
          fs.closeSync(fd);
          res.end('ok');
        });
      });
    },
  };
}
