import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias: { '@literal/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)) } },
  build: { outDir: '../../dist', emptyOutDir: true },
  server: { host: '127.0.0.1' },
});
