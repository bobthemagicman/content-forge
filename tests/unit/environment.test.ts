// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENV_NAME_PATTERN, resolveEnvName } from "../../amplify/environment";

describe("resolveEnvName", () => {
  it("uses the branch on Amplify Hosting", () => {
    expect(resolveEnvName("master", "ignored")).toBe("master");
  });

  it("derives a sandbox name from the OS user", () => {
    expect(resolveEnvName(undefined, "jane.doe")).toBe("sandbox-jane.doe");
  });

  it("lets a sandbox override an awkward username through AWS_BRANCH", () => {
    expect(resolveEnvName("sandbox-jane", "Jane Doe")).toBe("sandbox-jane");
  });

  it.each(["feature/search", "main", "sandbox-", "sandbox-a/b", "../master"])("rejects the branch %s", (branch) => {
    expect(() => resolveEnvName(branch, "jane")).toThrow(/Only the master branch deploys/);
  });

  it("rejects a username that can't be part of a parameter path", () => {
    expect(() => resolveEnvName(undefined, "Jane Doe")).toThrow(/AWS_BRANCH=sandbox-<name>/);
  });

  it("accepts exactly the names the signing-key script accepts", () => {
    const script = readFileSync(
      fileURLToPath(new URL("../../scripts/bootstrap/create-signing-keys.sh", import.meta.url)),
      "utf8",
    );
    const scriptPattern = /=~ (\S+) \]\]/.exec(script)?.[1];
    expect(scriptPattern).toBe(ENV_NAME_PATTERN.source);
  });
});
