import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { htmlIncludes } from './vite-plugins/html-includes';

const page = (file: string) => resolve(import.meta.dirname, file);

export default defineConfig({
  plugins: [htmlIncludes()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: {
        home: page('index.html'),
        services: page('services/index.html'),
        about: page('about/index.html'),
        contact: page('contact/index.html'),
        privacy: page('privacy/index.html'),
        terms: page('terms/index.html'),
        notFound: page('404.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
