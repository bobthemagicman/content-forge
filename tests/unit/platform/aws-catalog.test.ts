import { describe, expect, it, vi } from "vitest";
import twin from "../../e2e/fixtures/platform-config.e2e.json";
import { parsePlatformConfig } from "@/lib/platform/config";

const generateClient = vi.hoisted(() => vi.fn(() => ({ graphql: vi.fn() })));
const configureAmplify = vi.hoisted(() => vi.fn());
vi.mock("aws-amplify/api", () => ({ generateClient }));
vi.mock("@/lib/platform/aws/amplify", () => ({ configureAmplify }));

const { graphqlClient } = await import("@/lib/platform/aws/catalog");

describe("graphqlClient", () => {
  it("configures Amplify, then creates one OIDC client on first use", () => {
    expect(generateClient).not.toHaveBeenCalled();
    const config = parsePlatformConfig(twin);
    const client = graphqlClient(config);
    expect(graphqlClient(config)).toBe(client);
    expect(configureAmplify).toHaveBeenCalledWith(config);
    expect(generateClient).toHaveBeenCalledExactlyOnceWith({ authMode: "oidc" });
  });
});
