import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // All suites share one SQLite database file — run them sequentially.
    fileParallelism: false,
    setupFiles: ["./tests/setup/env.ts"],
    globalSetup: ["./tests/setup/global.ts"],
    testTimeout: 30000,
    hookTimeout: 120000,
    include: ["tests/**/*.test.ts"],
  },
});
