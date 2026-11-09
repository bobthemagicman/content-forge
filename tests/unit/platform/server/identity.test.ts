import { describe, expect, it } from "vitest";
import { isWorkspaceMember } from "../../../../amplify/lib/platform/identity";

// The asset plane's cases are in tests/unit/assets/session-handler.test.ts; these cover the claim name.
describe("isWorkspaceMember", () => {
  const member = { email: "ada@example.com", email_verified: true, hd: "example.com" };

  it("reads the hosted domain from the broker's claim", () => {
    expect(isWorkspaceMember(member, "example.com", "hd")).toBe(true);
    expect(isWorkspaceMember(member, "example.com", "custom:hd")).toBe(false);
  });

  it("compares the domain without regard to case", () => {
    expect(isWorkspaceMember(member, "Example.COM", "hd")).toBe(true);
  });

  it.each([
    ["an unverified address", { ...member, email_verified: false }],
    ["an address outside the domain", { ...member, email: "ada@example.org" }],
    ["another Workspace", { ...member, hd: "example.org" }],
  ])("refuses %s", (_, claims) => {
    expect(isWorkspaceMember(claims, "example.com", "hd")).toBe(false);
  });
});
