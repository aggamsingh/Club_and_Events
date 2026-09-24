import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The dev server proxies /api to Express, so the browser only ever talks to one
    // origin — exactly like production, where Express serves the built app.
    proxy: {
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:5000',
    },
  },
  build: {
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
