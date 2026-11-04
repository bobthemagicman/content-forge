import type { PreSignUpTriggerEvent } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../../../amplify/auth/pre-sign-up/handler";

type TriggerSource = PreSignUpTriggerEvent["triggerSource"];

function event(email: string | undefined, triggerSource: TriggerSource = "PreSignUp_ExternalProvider") {
  return {
    triggerSource,
    request: { userAttributes: email === undefined ? {} : { email } },
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

  it.each<TriggerSource>(["PreSignUp_ExternalProvider", "PreSignUp_AdminCreateUser", "PreSignUp_SignUp"])(
    "applies to %s",
    async (source) => {
      await expect(run(event("user@gmail.com", source))).rejects.toThrow("ONLY_ALLOWED_DOMAIN");
      await expect(run(event("user@example.com", source))).resolves.toBeDefined();
    },
  );

  it("fails closed when ALLOW_DOMAIN is unset", async () => {
    vi.stubEnv("ALLOW_DOMAIN", "");
    await expect(run(event("user@example.com"))).rejects.toThrow("ONLY_ALLOWED_DOMAIN");
  });
});
