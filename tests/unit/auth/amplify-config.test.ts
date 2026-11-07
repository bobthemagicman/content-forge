import { describe, expect, it, vi } from "vitest";
import outputs from "../../e2e/fixtures/amplify_outputs.e2e.json";

const configure = vi.hoisted(() => vi.fn());
vi.mock("aws-amplify", () => ({ Amplify: { configure } }));
vi.mock("@/../amplify_outputs.json", () => ({ default: outputs }));

const { assetsBaseUrl, configureAmplify } = await import("@/lib/auth/amplify-config");

describe("configureAmplify", () => {
  it("configures once, without the identity pool", () => {
    configureAmplify();
    configureAmplify();
    expect(configure).toHaveBeenCalledOnce();
    const config = configure.mock.calls[0]![0];
    expect(config.auth.identity_pool_id).toBeUndefined();
    expect(config.auth.user_pool_client_id).toBe(outputs.auth.user_pool_client_id);
    expect(config.auth.oauth).toEqual(outputs.auth.oauth);
  });

  it("reads the asset base URL from the custom outputs", () => {
    expect(assetsBaseUrl()).toBe("https://assets.e2e.test");
  });
});
