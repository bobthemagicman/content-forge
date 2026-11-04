import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      // Amplify function handlers import `$amplify/env/<name>`; tests use the committed stubs (T005).
      { find: /^\$amplify\/(.*)$/, replacement: fileURLToPath(new URL("./tests/setup/amplify-generated/$1", import.meta.url)) },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/component/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup/vitest.setup.ts"],
  },
});
