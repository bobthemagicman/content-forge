import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssetSessionBanner,
  AssetSessionProvider,
  CHECK_INTERVAL_MS,
  ERROR_RENEWAL_GAP_MS,
  useAssetSession,
} from "@/lib/assets/asset-session";
import { type Session, SessionContext } from "@/lib/auth/session";

// The asset session (T037, contracts/assets-cdn.md "Client obligations").

vi.mock("@/lib/config", () => ({ ASSETS_BASE_URL: "https://assets.example.com", DEMO_MODE: false }));

const MINUTE = 60_000;
const session: Session = {
  status: "signedIn",
  user: { email: "ada@example.com", name: "Ada" },
  signIn: vi.fn(),
  signOut: vi.fn(),
  idToken: vi.fn(async () => "id-token-jwt"),
};

/** `/_session`'s `204`, with cookies that expire `minutes` from now. */
function cookies(minutes: number): Response {
  const expires = new Date(Date.now() + minutes * MINUTE).toISOString();
  return new Response(null, { status: 204, headers: { "X-Session-Expires": expires } });
}

/** One of `/_session`'s error responses. */
const failure = (status: 401 | 403 | 500) => new Response(JSON.stringify({ error: "x" }), { status });

let fetchMock: ReturnType<typeof vi.fn>;
/** Stands in for the catalog: its button reports a failed asset, as an image's onError would. */
function Catalog() {
  const { reportAssetError } = useAssetSession();
  return (
    <>
      <p>catalog</p>
      <button type="button" onClick={reportAssetError}>
        asset failed
      </button>
    </>
  );
}
const reportAssetError = () => fireEvent.click(screen.getByRole("button", { name: "asset failed" }));

const renderProvider = () =>
  render(
    <SessionContext.Provider value={session}>
      <AssetSessionProvider>
        <AssetSessionBanner />
        <Catalog />
      </AssetSessionProvider>
    </SessionContext.Provider>,
  );

const sessionCalls = () => fetchMock.mock.calls.filter(([url]) => url === "https://assets.example.com/_session");

beforeEach(() => {
  vi.clearAllMocks();
  // Fake only the clock and the interval, so promises run normally. Testing Library's waitFor polls
// with the faked setInterval, so the tests wait with vi.waitFor instead.
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AssetSessionProvider", () => {
  it("renders nothing from the catalog until /_session answers 204", async () => {
    let answer!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (answer = resolve)));
    renderProvider();

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByText("catalog")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("https://assets.example.com/_session", {
      credentials: "include",
      headers: { "X-Id-Token": "id-token-jwt" },
    });

    await act(async () => answer(cookies(12 * 60)));
    expect(screen.getByText("catalog")).toBeInTheDocument();
  });

  it("renews the cookies once less than 60 minutes remain", async () => {
    fetchMock.mockResolvedValueOnce(cookies(90)).mockResolvedValue(cookies(12 * 60));
    renderProvider();
    await screen.findByText("catalog");

    // 75 and then 60 minutes left: not yet.
    await act(async () => vi.advanceTimersByTime(2 * CHECK_INTERVAL_MS));
    expect(sessionCalls()).toHaveLength(1);

    // 45 minutes left.
    await act(async () => vi.advanceTimersByTime(CHECK_INTERVAL_MS));
    await vi.waitFor(() => expect(sessionCalls()).toHaveLength(2));
    expect(screen.getByText("catalog")).toBeInTheDocument();
  });

  it("also checks when the window regains focus", async () => {
    fetchMock.mockResolvedValueOnce(cookies(30)).mockResolvedValue(cookies(12 * 60));
    renderProvider();
    await screen.findByText("catalog");
    await act(async () => {}); // lets the renewal effect attach its listeners

    fireEvent.focus(window);
    await vi.waitFor(() => expect(sessionCalls()).toHaveLength(2));
  });

  it("renews on an asset error, at most once a minute, and keeps the session when that works", async () => {
    fetchMock.mockResolvedValue(cookies(12 * 60));
    renderProvider();
    await screen.findByText("catalog");

    await act(async () => reportAssetError());
    expect(sessionCalls()).toHaveLength(2);

    // Another broken image straight away: no second renewal, and no false "expired".
    await act(async () => reportAssetError());
    expect(sessionCalls()).toHaveLength(2);

    // A minute on, an unrelated asset fails: renewed again, still no banner.
    await act(async () => vi.advanceTimersByTime(ERROR_RENEWAL_GAP_MS));
    await act(async () => reportAssetError());
    expect(sessionCalls()).toHaveLength(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("asks the user to sign in again when that renewal fails", async () => {
    fetchMock.mockResolvedValueOnce(cookies(12 * 60)).mockResolvedValue(failure(500));
    renderProvider();
    await screen.findByText("catalog");

    await act(async () => reportAssetError());
    expect(screen.getByRole("alert")).toHaveTextContent("Your session expired.");
    // The catalog stays on screen behind the banner.
    expect(screen.getByText("catalog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(session.signOut).toHaveBeenCalledOnce();
  });

  it("treats errors during a renewal as the same failure", async () => {
    let answer!: (response: Response) => void;
    fetchMock
      .mockResolvedValueOnce(cookies(12 * 60))
      .mockReturnValueOnce(new Promise<Response>((resolve) => (answer = resolve)));
    renderProvider();
    await screen.findByText("catalog");

    // Six thumbnails fail at once.
    for (let i = 0; i < 6; i++) reportAssetError();
    await act(async () => answer(cookies(12 * 60)));
    expect(sessionCalls()).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("signs out on a 401 and never shows the catalog", async () => {
    fetchMock.mockResolvedValue(failure(401));
    renderProvider();

    await vi.waitFor(() => expect(session.signOut).toHaveBeenCalledOnce());
    expect(screen.queryByText("catalog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("signs out when there's no ID token to exchange", async () => {
    vi.mocked(session.idToken).mockResolvedValueOnce(undefined);
    renderProvider();

    await vi.waitFor(() => expect(session.signOut).toHaveBeenCalledOnce());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers a retry when /_session fails for another reason", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(cookies(12 * 60));
    renderProvider();

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("We couldn’t load the library.");
    expect(session.signOut).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("catalog")).toBeInTheDocument();
  });

  it("doesn't sign out on a 403, which signing in again won't fix", async () => {
    fetchMock.mockResolvedValue(failure(403));
    renderProvider();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t load the library.");
    expect(session.signOut).not.toHaveBeenCalled();
  });
});
