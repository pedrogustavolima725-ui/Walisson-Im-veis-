// Build da versão de demonstração: um único HTML autossuficiente (sem servidor),
// com a API simulada no navegador. Uso: npm run build:demo
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'client',
  publicDir: false,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
  build: { outDir: '../dist-demo', emptyOutDir: true, chunkSizeWarningLimit: 5000 },
});
