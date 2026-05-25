import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@livingdocs/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@livingdocs/core': resolve(__dirname, '../core/src/index.ts'),
      '@livingdocs/engine': resolve(__dirname, '../engine/src/index.ts'),
    },
  },
});
