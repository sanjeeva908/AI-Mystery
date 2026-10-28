import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/mongo.integration.test.ts'],
    setupFiles: ['tests/mongo.integration.setup.ts'],
    testTimeout: 120000,
  },
});
