import type { PreSignUpTriggerEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../../../amplify/auth/pre-sign-up/handler";

type TriggerSource = PreSignUpTriggerEvent["triggerSource"];

function event(
  email: string | undefined,
  triggerSource: TriggerSource = "PreSignUp_ExternalProvider",
  extra: Record<string, string> = { "custom:hd": "example.com", email_verified: "true" },
) {
  return {
    triggerSource,
    request: { userAttributes: { ...extra, ...(email === undefined ? {} : { email }) } },
    response: { autoConfirmUser: false, autoVerifyEmail: false, autoVerifyPhone: false },
  } as unknown as PreSignUpTriggerEvent;
}

// The handler is async, so the callback and context arguments are unused.
const run = (e: PreSignUpTriggerEvent) => handler(e, {} as never, () => {});

describe("pre-sign-up trigger", () => {
  beforeEach(() => vi.stubEnv("ALLOW_DOMAIN", "example.com"));
  afterEach(() => vi.unstubAllEnvs());

  it.each(["user@example.com", "USER@Example.com"])("accepts %s", async (email) => {
    const e = event(email);
    await expect(run(e)).resolves.toBe(e);
  });

  it.each(["user@gmail.com", "user@example.com.evil.com", "user@sub.example.com", "userexample.com", ""])(
    "rejects %j",
    async (email) => {
      await expect(run(event(email))).rejects.toThrow("ONLY_ALLOWED_DOMAIN");
    },
  );

  it("rejects a missing email", async () => {
    await expect(run(event(undefined))).rejects.toThrow("ONLY_ALLOWED_DOMAIN");
  });

  it.each<TriggerSource>(["PreSignUp_AdminCreateUser", "PreSignUp_SignUp"])(
    "refuses %s: accounts come only from Google sign-in",
    async (source) => {
      await expect(run(event("user@example.com", source))).rejects.toThrow("ONLY_ALLOWED_DOMAIN");
    },
  );

  describe("Google's hosted-domain claim (custom:hd)", () => {
    it("accepts it in any case", async () => {
      const e = event("user@example.com", "PreSignUp_ExternalProvider", { "custom:hd": "Example.COM" });
      await expect(run(e)).resolves.toBe(e);
    });

    it.each([
      ["missing (a consumer Google account using a company address)", {}],
      ["another Workspace", { "custom:hd": "other.com" }],
      ["a subdomain", { "custom:hd": "sub.example.com" }],
      ["a lookalike", { "custom:hd": "example.com.evil.com" }],
      ["empty", { "custom:hd": "" }],
    ])("rejects it when %s", async (_, extra) => {
      await expect(run(event("user@example.com", "PreSignUp_ExternalProvider", extra))).rejects.toThrow(
        "ONLY_ALLOWED_DOMAIN",
      );
    });

    it("still requires the email to be in the domain", async () => {
      await expect(run(event("user@other.com"))).rejects.toThrow("ONLY_ALLOWED_DOMAIN");
    });
  });

  it("rejects an unverified email", async () => {
    const e = event("user@example.com", "PreSignUp_ExternalProvider", { "custom:hd": "example.com", email_verified: "false" });
    await expect(run(e)).rejects.toThrow("ONLY_ALLOWED_DOMAIN");
  });

  it("fails closed when ALLOW_DOMAIN is unset", async () => {
    vi.stubEnv("ALLOW_DOMAIN", "");
    await expect(run(event("user@example.com"))).rejects.toThrow("ONLY_ALLOWED_DOMAIN");
  });
});
