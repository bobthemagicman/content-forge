// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// The server-side boundary (T136): handlers and the neutral platform code use ports, not SDKs.
const eslint = new ESLint({ cwd: process.cwd() });

async function restrictedImports(code: string, filePath: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.filter((m) => m.ruleId === "no-restricted-imports").length;
}

describe("no-restricted-imports: server SDKs", () => {
  it.each([
    ["amplify/custom/assets-cdn/session-handler.ts", 'import { SSMClient } from "@aws-sdk/client-ssm";'],
    ["amplify/custom/downloads/get-download-url-handler.ts", 'import { getSignedUrl } from "@aws-sdk/cloudfront-signer";'],
    ["amplify/lib/platform/jwt-verifier.ts", 'import { CognitoJwtVerifier } from "aws-jwt-verify";'],
  ])("refuses an SDK import in %s", async (file, code) => {
    expect(await restrictedImports(code, file)).toBe(1);
  }, 30_000);

  it.each([
    ["amplify/lib/platform/aws/ssm-settings.ts", 'import { SSMClient } from "@aws-sdk/client-ssm";'],
    ["amplify/parameters.ts", 'import { SSMClient } from "@aws-sdk/client-ssm";'],
  ])("allows it in %s", async (file, code) => {
    expect(await restrictedImports(code, file)).toBe(0);
  }, 30_000);
});
