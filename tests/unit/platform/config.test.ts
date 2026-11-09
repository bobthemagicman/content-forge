import { describe, expect, it } from "vitest";
import amplifyOutputs from "../../e2e/fixtures/amplify_outputs.e2e.json";
import twin from "../../e2e/fixtures/platform-config.e2e.json";
import { toPlatformConfig } from "../../../scripts/platform/aws-outputs-to-config.mjs";
import { PlatformConfigError, parseCognitoIssuer, parsePlatformConfig } from "@/lib/platform/config";

type Draft = typeof twin;
const valid = (): Draft => structuredClone(twin);

describe("aws-outputs-to-config", () => {
  it("converts the E2E fixture's amplify_outputs.json into its platform-config.json twin", () => {
    expect(toPlatformConfig(amplifyOutputs)).toEqual(twin);
  });

  it("produces a config the app accepts", () => {
    expect(parsePlatformConfig(toPlatformConfig(amplifyOutputs))).toEqual(twin);
  });

  it("drops a trailing slash from the asset host", () => {
    const outputs = { ...amplifyOutputs, custom: { assetsBaseUrl: "https://d111.cloudfront.net/" } };
    expect(toPlatformConfig(outputs).assets.baseUrl).toBe("https://d111.cloudfront.net");
  });

  it("names every missing output", () => {
    expect(() => toPlatformConfig({ auth: amplifyOutputs.auth })).toThrow(/data\.url, data\.aws_region, custom\.assetsBaseUrl/);
  });
});

describe("parsePlatformConfig", () => {
  it("accepts the E2E twin", () => {
    expect(parsePlatformConfig(valid())).toEqual(twin);
  });

  it("refuses a missing issuer", () => {
    const config = valid();
    Reflect.deleteProperty(config.auth, "issuer");
    expect(() => parsePlatformConfig(config)).toThrow(/auth\.issuer: missing/);
  });

  it.each([
    ["the issuer", (c: Draft) => (c.auth.issuer = "http://cognito-idp.us-west-2.amazonaws.com/us-west-2_abc")],
    ["a sign-in redirect", (c: Draft) => (c.auth.signInRedirects = ["http://content.example.com/auth/callback/"])],
    ["the catalog", (c: Draft) => (c.catalog.url = "http://e2e.appsync-api.us-west-2.amazonaws.com/graphql")],
    ["the asset host", (c: Draft) => (c.assets.baseUrl = "http://assets.example.com")],
  ])("refuses a non-HTTPS URL for %s", (_, mutate) => {
    const config = valid();
    mutate(config);
    expect(() => parsePlatformConfig(config)).toThrow(/must be https/);
  });

  it("allows plain HTTP only on localhost", () => {
    const config = valid();
    config.auth.signInRedirects = ["http://localhost:3000/auth/callback/"];
    expect(parsePlatformConfig(config).auth.signInRedirects).toEqual(["http://localhost:3000/auth/callback/"]);
    config.auth.signInRedirects = ["http://localhost.example.com/auth/callback/"];
    expect(() => parsePlatformConfig(config)).toThrow(/must be https/);
  });

  it.each([
    ["provider", (c: Draft) => (c.provider = "gcp")],
    ["auth.kind", (c: Draft) => (c.auth.kind = "firebase")],
    ["catalog.kind", (c: Draft) => (c.catalog.kind = "rest")],
  ])("refuses an unknown %s", (path, mutate) => {
    const config = valid();
    mutate(config);
    expect(() => parsePlatformConfig(config)).toThrow(new RegExp(`${path.replace(".", "\\.")}: "\\w+" is not one of`));
  });

  it.each([
    ["an asset host with a path", (c: Draft) => (c.assets.baseUrl = "https://assets.example.com/v"), /assets\.baseUrl: must be an origin/],
    ["a domain with a scheme", (c: Draft) => (c.auth.domain = "https://login.example.com"), /auth\.domain: must be a host name/],
    ["scopes without openid", (c: Draft) => (c.auth.scopes = ["email"]), /must include "openid"/],
    ["no sign-out redirects", (c: Draft) => (c.auth.signOutRedirects = []), /signOutRedirects: missing, or not a non-empty array/],
    ["an issuer that isn't a user pool", (c: Draft) => (c.auth.issuer = "https://accounts.google.com"), /not a Cognito user pool issuer/],
    ["a bad region", (c: Draft) => (c.catalog.region = "Oregon"), /catalog\.region: not an AWS region/],
  ])("refuses %s", (_, mutate, message) => {
    const config = valid();
    mutate(config);
    expect(() => parsePlatformConfig(config)).toThrow(message);
  });

  it("reports every problem at once", () => {
    const config = valid();
    Reflect.deleteProperty(config.auth, "clientId");
    config.assets.baseUrl = "ftp://assets.example.com";
    const error = (() => {
      try {
        parsePlatformConfig(config);
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(PlatformConfigError);
    expect((error as Error).message).toMatch(/auth\.clientId[\s\S]*assets\.baseUrl/);
  });

  it.each([null, [], "config"])("refuses %j as the whole file", (value) => {
    expect(() => parsePlatformConfig(value)).toThrow(/\(root\): missing, or not an object/);
  });
});

describe("parseCognitoIssuer", () => {
  it("splits the region and the user pool id", () => {
    expect(parseCognitoIssuer(twin.auth.issuer)).toEqual({ region: "us-west-2", userPoolId: "us-west-2_E2Etest00" });
  });
});
