import { describe, expect, it } from "vitest";
import { signInErrorCode } from "@/lib/auth/sign-in-error";

describe("signInErrorCode", () => {
  it.each([
    "PreSignUp failed with error ONLY_ALLOWED_DOMAIN.",
    "PreSignUp+failed+with+error+ONLY_ALLOWED_DOMAIN.+",
    "only_allowed_domain",
  ])("maps a domain rejection (%j) to domain", (message) => {
    expect(signInErrorCode(message)).toBe("domain");
  });

  it.each(["access_denied", "invalid_request", "", null, undefined])("maps %j to signin", (message) => {
    expect(signInErrorCode(message)).toBe("signin");
  });
});
