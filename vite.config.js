import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss(), autoprefixer()] } },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/media': 'http://localhost:8787'
    }
  },
  build: {
    target: 'esnext',
    sourcemap: false
  }
});
