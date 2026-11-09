import { describe, expect, it } from "vitest";
import type { AssetSigner } from "../../../../../amplify/lib/platform/ports";

/** A signer for the asset host `assetHost` and the demo host `demosHost`. */
export type MakeAssetSigner = (hosts: { assetHost: string; demosHost: string }) => AssetSigner;

const HOSTS = { assetHost: "assets.example.com", demosHost: "demos.example.net" };
const EXPIRES = new Date("2026-11-07T00:00:00Z");

/**
 * The parts of contracts/assets-cdn.md every signer shares. Whether the host accepts what's signed
 * is the adapter's own test, since each host checks signatures its own way.
 */
export function describeAssetSignerContract(name: string, make: MakeAssetSigner) {
  describe(`AssetSigner contract: ${name}`, () => {
    it("signs one value for each cookie it names, so sign-out can clear them all", async () => {
      const signer = make(HOSTS);
      expect(signer.cookieNames.length).toBeGreaterThan(0);
      const cookies = await signer.sessionCookies(EXPIRES);
      expect(Object.keys(cookies).sort()).toEqual([...signer.cookieNames].sort());
      for (const value of Object.values(cookies)) expect(value).toMatch(/^[\w~.-]+$/);
    });

    it("links a demo through the demo host's launch path, for that demo's entry page", async () => {
      const url = new URL(await make(HOSTS).demoLaunchUrl("item-1", "site%20files/index.html", EXPIRES));
      expect(url.origin).toBe("https://demos.example.net");
      expect(url.pathname).toBe("/_launch/item-1/site%20files/index.html");
    });

    it("signs a download URL for an archive on the asset host", async () => {
      const url = new URL(await make(HOSTS).downloadUrl("a/item-1/Big Theme.zip", EXPIRES));
      expect(url.origin).toBe("https://assets.example.com");
      expect(url.pathname).toBe("/a/item-1/Big%20Theme.zip");
      expect(url.search).not.toBe("");
    });

    it.each(["v/item-1/thumb.webp", "a/../v/item-1/thumb.webp", "a/item-1", "/a/item-1/x.zip", "d/item-1/index.html"])(
      "refuses to sign a download URL for %s",
      async (key) => {
        await expect(make(HOSTS).downloadUrl(key, EXPIRES)).rejects.toThrow();
      },
    );
  });
}
