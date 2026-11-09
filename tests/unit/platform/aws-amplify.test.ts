import { describe, expect, it, vi } from "vitest";
import twin from "../../e2e/fixtures/platform-config.e2e.json";
import { parsePlatformConfig } from "@/lib/platform/config";

const configure = vi.hoisted(() => vi.fn());
vi.mock("aws-amplify", () => ({ Amplify: { configure } }));

const { configureAmplify } = await import("@/lib/platform/aws/amplify");

describe("configureAmplify", () => {
  it("configures once, from platform-config.json, without an identity pool", () => {
    const config = parsePlatformConfig(twin);
    configureAmplify(config);
    configureAmplify(config);
    expect(configure).toHaveBeenCalledOnce();
    expect(configure.mock.calls[0]![0]).toEqual({
      Auth: {
        Cognito: {
          userPoolId: "us-west-2_E2Etest00",
          userPoolClientId: twin.auth.clientId,
          loginWith: {
            oauth: {
              domain: twin.auth.domain,
              scopes: ["openid", "email", "profile"],
              redirectSignIn: twin.auth.signInRedirects,
              redirectSignOut: twin.auth.signOutRedirects,
              responseType: "code",
              providers: [],
            },
          },
        },
      },
      API: { GraphQL: { endpoint: twin.catalog.url, region: "us-west-2", defaultAuthMode: "oidc" } },
    });
  });
});
