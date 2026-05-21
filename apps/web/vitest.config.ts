import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Default 5 000 ms is too short for integration tests that read real
    // USCIS PDFs from disk, fill them via pdf-lib, and generate ZIP bundles.
    // 30 s covers the slowest observed case (~6 s per test on CI).
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
