import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['packages/shared/src/**/__tests__/**/*.test.{ts,tsx}']
  }
});
