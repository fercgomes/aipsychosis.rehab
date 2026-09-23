import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { relative, sep } from 'node:path';

const watched = new Set(['src', 'static', 'index.html', 'vite.config.js', 'package.json', 'package-lock.json']);

export default defineConfig({
  plugins: [react()],
  publicDir: 'static',
  optimizeDeps: { entries: ['index.html'] },
  server: {
    watch: {
      ignored: file => {
        const local = relative(import.meta.dirname, file);
        return local !== '' && !watched.has(local.split(sep)[0]);
      },
    },
  },
  build: {
    rolldownOptions: { output: { manualChunks: id => id.includes('/node_modules/three/') ? 'three' : undefined } },
  },
});
