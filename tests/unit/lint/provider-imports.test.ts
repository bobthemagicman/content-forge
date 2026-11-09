// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// The boundary from specs/003-portable-deployment/plan.md "Ports" (T135): cloud SDKs and Amplify's
// files only inside src/lib/platform/aws/.
const eslint = new ESLint({ cwd: process.cwd() });

async function restrictedImports(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.filter((m) => m.ruleId === "no-restricted-imports").map((m) => m.message);
}

describe("no-restricted-imports: provider SDKs", () => {
  it.each([
    'import { fetchAuthSession } from "aws-amplify/auth";',
    'import { Amplify } from "aws-amplify";',
    'import { S3Client } from "@aws-sdk/client-s3";',
    'import { CognitoJwtVerifier } from "aws-jwt-verify";',
    'import outputs from "@/../amplify_outputs.json";',
    'import type { Schema } from "@/../amplify/data/schema";',
  ])("refuses %s outside the AWS adapters", async (code) => {
    expect(await restrictedImports(code, "src/components/example.tsx")).toHaveLength(1);
  }, 30_000);

  it("allows them in src/lib/platform/aws/", async () => {
    expect(await restrictedImports('import { Amplify } from "aws-amplify";', "src/lib/platform/aws/example.ts")).toEqual([]);
  }, 30_000);

  it("allows the ports", async () => {
    expect(await restrictedImports('import { authClient } from "@/lib/platform/auth";', "src/components/example.tsx")).toEqual([]);
  }, 30_000);
});
