// `npm run web`: the app's screens in a browser, plus both editors' dev servers (docs/web-preview.md).
import { spawn } from 'node:child_process';

const commands = [
  'npx expo start --web --port 8082',
  'npm run dev --prefix photo-editor-web',
  'npm run dev --prefix video-editor-web',
];

const children = commands.map((command) => spawn(command, { stdio: 'inherit', shell: true }));

const stop = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
