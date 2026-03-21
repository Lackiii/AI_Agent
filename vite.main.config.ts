import { defineConfig } from 'vite';

// https://vitejs.dev/config
// `ws` optionally requires native `bufferutil` / `utf-8-validate`; bundling breaks that path.
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['ws'],
    },
  },
});
