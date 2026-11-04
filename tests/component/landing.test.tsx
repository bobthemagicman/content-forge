import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Landing } from "@/components/landing/landing";
import type { Session } from "@/lib/auth/session";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const nav = vi.hoisted(() => ({ search: "" }));
const session = vi.hoisted(() => ({ current: {} as Session }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("next/font/google", () => ({ Roboto: () => ({ className: "roboto" }) }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => session.current }));

function setSession(overrides: Partial<Session> = {}) {
  session.current = {
    status: "signedOut",
    user: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    idToken: async () => undefined,
    ...overrides,
  };
}

describe("Landing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    setSession();
  });

  it("explains a domain rejection", () => {
    nav.search = "error=domain";
    render(<Landing />);
    expect(screen.getByRole("alert")).toHaveTextContent("That Google account can’t sign in.");
    expect(screen.getByRole("alert")).toHaveTextContent("allowed Google Workspace domain");
  });

  it("explains an unfinished sign-in", () => {
    nav.search = "error=signin";
    render(<Landing />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in didn’t finish.");
  });

  it("ignores unknown error codes", () => {
    nav.search = "error=nope";
    render(<Landing />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("signs in from the keyboard", async () => {
    const user = userEvent.setup();
    render(<Landing />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(session.current.signIn).toHaveBeenCalledOnce();
  });

  it("disables sign-in while the session is loading", () => {
    setSession({ status: "loading" });
    render(<Landing />);
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeDisabled();
  });

  it("sends a signed-in visitor to browse", () => {
    setSession({ status: "signedIn", user: { email: "a@example.com", name: "A" } });
    render(<Landing />);
    expect(router.replace).toHaveBeenCalledWith("/browse/");
  });
});
