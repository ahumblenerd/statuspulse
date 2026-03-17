import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/test/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    testTimeout: 10000,
    pool: "forks",
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**",
        "src/vendors/**",
        "src/ingestion/**",
        "src/alerts/**",
        "src/api/**",
        "src/db/**",
      ],
      exclude: ["src/restate/**", "src/mcp/**", "src/index.ts"],
    },
  },
});
