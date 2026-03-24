import { defineConfig } from 'vite';

// https://vitejs.dev/config
// - Bundle `ws` (do not externalize it) so packaged apps don't need `node_modules/ws` in asar.
// - Keep `ws`'s optional native deps external so Rollup leaves `require(...)` in the bundle; `ws` catches MODULE_NOT_FOUND.
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['bufferutil', 'utf-8-validate'],
    },
  },
});
