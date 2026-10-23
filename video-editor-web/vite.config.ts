import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { devMediaPlugin } from './src/adapters/dev/mediaPlugin.ts';

export default defineConfig({
  plugins: [react(), devMediaPlugin()],
  server: { port: 5174 },
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
});
