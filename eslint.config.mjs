import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The CSP allows inline scripts for Next's static pages, so raw HTML injection stays banned (research R18).
      "react/no-danger": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated or tool output:
    ".amplify/**",
    "**/cdk.out/**",
    "amplify_outputs*.json",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
