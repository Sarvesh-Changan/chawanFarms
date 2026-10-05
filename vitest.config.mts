import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    maxWorkers: 1,
    pool: "threads",
    setupFiles: ["./tests/unit/setup.ts"],
  },
});
