import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run in Node.js environment for proper ESM module resolution
    environment: 'node',
    // Exclude integration tests from default run (require live sandbox)
    exclude: [
      '**/node_modules/**',
      '**/tests/sdk.integration.test.ts',
    ],
  },
});
