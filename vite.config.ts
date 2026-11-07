import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3333',
      '/uploads': 'http://localhost:3333',
    },
  },
});
