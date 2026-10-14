import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  cacheDir: mode === 'test' ? 'node_modules/.vite-e2e' : 'node_modules/.vite',
  server: {
    watch: {
      ignored: ['**/Temp/**', '**/reports/**', '**/playwright-report/**', '**/test-results/**'],
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
