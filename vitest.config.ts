import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [
    vue({
      template: { transformAssetUrls: { base: null, includeAbsolute: false } },
    }),
  ],
  resolve: {
    alias: {
      src: path.resolve(import.meta.dirname, './src'),
      app: path.resolve(import.meta.dirname, './'),
      components: path.resolve(import.meta.dirname, './src/components'),
      layouts: path.resolve(import.meta.dirname, './src/layouts'),
      pages: path.resolve(import.meta.dirname, './src/pages'),
      assets: path.resolve(import.meta.dirname, './src/assets'),
      boot: path.resolve(import.meta.dirname, './src/boot'),
      stores: path.resolve(import.meta.dirname, './src/stores'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
