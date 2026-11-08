// @vitest-environment node
import { ParameterNotFound } from "@aws-sdk/client-ssm";
import { afterEach, describe, expect, it, vi } from "vitest";

// The SSM side of amplify/parameters.ts: a missing parameter is "not set up yet", which callers
// explain; any other failure (no credentials, access denied) must surface as itself.
const send = vi.fn();
vi.mock("@aws-sdk/client-ssm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-ssm")>();
  return {
    ...actual,
    SSMClient: class {
      send = send;
    },
  };
});
const { PARAMETERS, readDeploymentParameter } = await import("../../amplify/parameters");

afterEach(() => {
  send.mockReset();
  vi.unstubAllEnvs();
});

describe("deployment parameters", () => {
  it("names one handover per auth environment and one public key per deployment", () => {
    expect(PARAMETERS.authEnvironment("dev")).toBe("/content-forge/auth/dev");
    expect(PARAMETERS.signingPublicKey("sandbox-someone")).toBe("/content-forge/sandbox-someone/cloudfront/public-key");
  });

  it("reads the value from SSM", async () => {
    send.mockResolvedValue({ Parameter: { Value: "v" } });
    await expect(readDeploymentParameter("/content-forge/auth/dev")).resolves.toBe("v");
    expect(send.mock.calls[0][0].input).toEqual({ Name: "/content-forge/auth/dev" });
  });

  it("returns undefined for a parameter that doesn't exist", async () => {
    send.mockRejectedValue(new ParameterNotFound({ message: "nope", $metadata: {} }));
    await expect(readDeploymentParameter("/content-forge/auth/dev")).resolves.toBeUndefined();
  });

  it("reports other failures with the parameter's name", async () => {
    send.mockRejectedValue(new Error("AccessDeniedException: not authorized"));
    await expect(readDeploymentParameter("/content-forge/auth/dev")).rejects.toThrow(
      "Couldn't read the SSM parameter /content-forge/auth/dev with the deploying credentials: AccessDeniedException",
    );
  });

  it("reads <dir>/<name> instead when CONTENT_FORGE_PARAMETERS_DIR is set", async () => {
    vi.stubEnv("CONTENT_FORGE_PARAMETERS_DIR", "/nonexistent-dir");
    await expect(readDeploymentParameter("/content-forge/auth/dev")).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
