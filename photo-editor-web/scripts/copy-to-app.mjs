// Copies the single-file build into the Android app's assets, where PhotoEditorWebScreen loads it.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../../android/app/src/main/assets/photo-editor');
mkdirSync(target, { recursive: true });
copyFileSync(resolve(here, '../dist/index.html'), resolve(target, 'index.html'));
console.log(`copied to ${target}`);
