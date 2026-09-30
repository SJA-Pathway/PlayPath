import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  server: {
    // `npm run dev` serves the client only; run `npx wrangler dev` alongside for /api (multiplayer + Claude NPCs).
    proxy: { '/api': { target: 'http://localhost:8787', ws: true } },
  },
});
