import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/services/__tests__/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['server/services/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      schema: path.resolve(__dirname, 'schema'),
    },
  },
});
