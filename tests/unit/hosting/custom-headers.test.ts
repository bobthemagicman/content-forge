// @vitest-environment node
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, customHeadersYaml } from "../../../scripts/hosting/custom-headers.mjs";

describe("production response headers (research R18)", () => {
  it("builds the R18 policy verbatim for the placeholder domain", () => {
    expect(contentSecurityPolicy("assets.example.com")).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https://assets.example.com https://*.googleusercontent.com; " +
        "media-src https://assets.example.com; font-src 'self'; " +
        "connect-src 'self' https://*.amazonaws.com https://*.amazoncognito.com https://assets.example.com; " +
        "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    );
  });

  it("keeps the inline allowances static pages and React Aria need", () => {
    const csp = contentSecurityPolicy("assets.example.com");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("emits every header for all paths", () => {
    const yaml = customHeadersYaml("assets.example.com");
    expect(yaml).toMatch(/^customHeaders:\n {2}- pattern: "\*\*"\n/);
    for (const key of ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Content-Security-Policy"]) {
      expect(yaml).toContain(`- key: ${key}\n`);
    }
  });

  it.each(["", "assets", "assets.example.com; script-src *", "https://assets.example.com"])(
    "rejects %j as a host",
    (host) => {
      expect(() => customHeadersYaml(host)).toThrow(/Not a host name/);
    },
  );
});
