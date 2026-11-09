import { describe, expect, it, vi } from "vitest";

const generateClient = vi.hoisted(() => vi.fn(() => ({ models: {} })));
const configureAmplify = vi.hoisted(() => vi.fn());
vi.mock("aws-amplify/data", () => ({ generateClient }));
vi.mock("@/lib/auth/amplify-config", () => ({ configureAmplify }));

const { dataClient } = await import("@/lib/data/client");

describe("dataClient (T031)", () => {
  it("is created on first use, once, in OIDC mode after configuring Amplify", () => {
    expect(generateClient).not.toHaveBeenCalled();
    const first = dataClient();
    expect(dataClient()).toBe(first);
    expect(generateClient).toHaveBeenCalledOnce();
    expect(generateClient).toHaveBeenCalledWith({ authMode: "oidc" });
    expect(configureAmplify.mock.invocationCallOrder[0]).toBeLessThan(generateClient.mock.invocationCallOrder[0]!);
  });
});
