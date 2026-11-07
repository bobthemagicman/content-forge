import { defineConfig } from "vitest/config";

// CDK assertion tests (tests/infra). Synthesizing stacks is slow, so they run apart from `npm test`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/infra/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
