// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Querystring = Record<string, { value: string }>;
type LaunchResponse = {
  statusCode: number;
  headers: Record<string, { value: string }>;
  cookies?: Record<string, { value: string; attributes: string }>;
};

// CloudFront Functions have no module system, so load the file the way CloudFront does: as a script
// that defines `handler`.
const source = readFileSync(
  fileURLToPath(new URL("../../../amplify/custom/assets-cdn/demo-launch.js", import.meta.url)),
  "utf8",
);
const handler = new Function(`${source}\nreturn handler;`)() as (event: unknown) => LaunchResponse;

const ID = "3f1c2b8e-9d4a-4c6b-8e2f-1a2b3c4d5e6f";
const SIGNED: Querystring = { p: { value: "eyJTdGF0~ZW1l-bnQ_" }, s: { value: "c2lnbmF0dXJl~-_" }, k: { value: "K2TESTKEYPAIR" } };

const launch = (uri: string, querystring: Querystring = SIGNED) => handler({ request: { uri, querystring } });

describe("demo-launch CloudFront Function", () => {
  it("moves the signed values into cookies scoped to the demo and redirects to its entry page", () => {
    const result = launch(`/_launch/${ID}/site%20files/index.html`);

    expect(result.statusCode).toBe(302);
    expect(result.headers.location!.value).toBe(`/${ID}/site%20files/index.html`);
    expect(result.headers["cache-control"]!.value).toBe("no-store");
    const attributes = `Path=/${ID}/; Secure; HttpOnly; SameSite=Lax; Max-Age=43200`;
    expect(result.cookies).toEqual({
      "CloudFront-Policy": { value: SIGNED.p!.value, attributes },
      "CloudFront-Signature": { value: SIGNED.s!.value, attributes },
      "CloudFront-Key-Pair-Id": { value: SIGNED.k!.value, attributes },
    });
  });

  it.each([
    ["no entry path", `/_launch/${ID}/`],
    ["no id", "/_launch//index.html"],
    ["an id with a dot", "/_launch/a.b/index.html"],
    ["a protocol-relative entry", `/_launch/${ID}//evil.example/x`],
    ["a backslash entry", `/_launch/${ID}/\\evil.example`],
    ["another path", `/${ID}/index.html`],
  ])("rejects %s", (_, uri) => {
    const result = launch(uri);
    expect(result.statusCode).toBe(400);
    expect(result.cookies).toBeUndefined();
  });

  it.each(["p", "s", "k"])("rejects a missing %s", (name) => {
    const querystring = { ...SIGNED };
    delete querystring[name];
    expect(launch(`/_launch/${ID}/index.html`, querystring).statusCode).toBe(400);
  });

  it.each(["a;b", "a b", "a%3Bb", "a=b", ""])("rejects a value that could inject cookie attributes: %j", (value) => {
    expect(launch(`/_launch/${ID}/index.html`, { ...SIGNED, p: { value } }).statusCode).toBe(400);
  });
});
