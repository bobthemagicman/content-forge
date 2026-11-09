import { describe, expect, it } from "vitest";
import { SettingNotFoundError, type SettingsStore } from "../../../../../amplify/lib/platform/ports";

/** A store holding `values` (names to values); `secrets` are stored encrypted where the store can. */
export type MakeSettingsStore = (values: Record<string, string>, secrets: Record<string, string>) => SettingsStore;

export function describeSettingsStoreContract(name: string, make: MakeSettingsStore) {
  describe(`SettingsStore contract: ${name}`, () => {
    const store = () => make({ "/app/test/domain": "assets.example.com", "/app/test/empty": "" }, { "/app/test/key": "-----BEGIN PRIVATE KEY-----" });

    it("returns a setting's value", async () => {
      await expect(store().get("/app/test/domain")).resolves.toBe("assets.example.com");
    });

    it("returns a secret's decrypted value", async () => {
      await expect(store().get("/app/test/key", { secret: true })).resolves.toBe("-----BEGIN PRIVATE KEY-----");
    });

    it.each(["/app/test/missing", "/app/test/empty"])("refuses %s with SettingNotFoundError", async (setting) => {
      const error = await store().get(setting).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SettingNotFoundError);
      expect((error as SettingNotFoundError).setting).toBe(setting);
    });
  });
}
