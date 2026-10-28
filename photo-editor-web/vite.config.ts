import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { devMediaPlugin } from './src/adapters/dev/mediaPlugin.ts';

/**
 * The app opens the editor from its APK assets (file://), where module scripts and separate
 * files are blocked: the build is ONE index.html with the script and styles inlined.
 */
function singleFile(): Plugin {
  return {
    name: 'pixelmorph-single-file',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find((f) => f.fileName.endsWith('.html'));
      if (!html || html.type !== 'asset') return;
      let page = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'chunk' && file.isEntry) {
          // Classic script at the end of <body>: the DOM exists when it runs.
          page = page.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/, '');
          page = page.replace('</body>', () => `<script>${file.code.replace(/<\/script/g, '<\/script')}</script></body>`);
          delete bundle[name];
        } else if (file.type === 'asset' && name.endsWith('.css')) {
          page = page.replace(/<link[^>]*rel="stylesheet"[^>]*>/, '');
          page = page.replace('</head>', () => `<style>${String(file.source)}</style></head>`);
          delete bundle[name];
        }
      }
      html.source = page;
    },
  };
}

export default defineConfig({
  plugins: [react(), devMediaPlugin(), singleFile()],
  base: './',
  server: { port: 5175 },
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
});
