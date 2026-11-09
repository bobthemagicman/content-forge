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
  {
    // Provider SDKs stay inside their adapters (specs/003-portable-deployment/plan.md "Ports", T135).
    // amplify/, infra/ and tools/ are the AWS backend and CLIs, and tests mock the SDKs, so this
    // covers only the app. tests/unit/lint/provider-imports.test.ts checks it fires.
    files: ["src/**/*.{ts,tsx,js,jsx,mjs}"],
    ignores: ["src/lib/platform/aws/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["aws-amplify", "aws-amplify/*", "@aws-amplify/*", "@aws-sdk/*", "aws-jwt-verify", "aws-jwt-verify/*"],
              message: "Cloud SDKs belong in src/lib/platform/aws/; use the ports in src/lib/platform/.",
            },
            {
              group: ["**/amplify_outputs.json", "**/amplify/**"],
              message: "The app reads its deployment through platform-config.json (src/lib/config.ts), not Amplify's files.",
            },
          ],
        },
      ],
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
    "platform-config.json",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
