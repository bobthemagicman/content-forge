import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Principle I (bounded logs): every Amplify function keeps its logs for two weeks. The AssetsCdn
// synth test covers the custom stack; this catches a new `defineFunction` added without retention.

const root = join(import.meta.dirname, "..", "..");

function resourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : resourceFiles(path);
    return entry.name === "resource.ts" ? [path] : [];
  });
}

/** The source of each `defineFunction({...})` call, by matching braces from its opening paren. */
function defineFunctionCalls(source: string): string[] {
  const calls: string[] = [];
  for (const match of source.matchAll(/defineFunction\(/g)) {
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < source.length; end++) {
      if (source[end] === "(") depth++;
      if (source[end] === ")" && --depth === 0) break;
    }
    calls.push(source.slice(match.index, end + 1));
  }
  return calls;
}

const functions = resourceFiles(join(root, "amplify")).flatMap((file) =>
  defineFunctionCalls(readFileSync(file, "utf8")).map((call) => ({ file: relative(root, file), call })),
);

describe("Amplify function log retention", () => {
  // None today: the pre-sign-up trigger moved to infra/auth (research R21), whose stack test checks
  // its retention. This keeps catching the next `defineFunction`.
  it("finds every defineFunction call", () => {
    expect(functions.every(({ call }) => call.startsWith("defineFunction("))).toBe(true);
  });

  it.each(functions)("$file sets logging retention to 2 weeks", ({ call }) => {
    expect(call).toMatch(/logging:\s*\{[^}]*retention:\s*["']2 weeks["']/);
  });
});
