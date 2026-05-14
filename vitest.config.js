import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/lib/**', 'src/api/**'],
    },
  },
});
