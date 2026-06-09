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
    // The first dynamic import of the API/provider tree (~3.7k-line client.js)
    // pays a one-time Vite transform + a best-effort breach-list prefetch. Give
    // cold imports room so CI isn't flaky on transform cost (not logic).
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/lib/**', 'src/api/**', 'src/providers/**'],
    },
  },
});
