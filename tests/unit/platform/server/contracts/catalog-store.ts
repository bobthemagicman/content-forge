import { describe, expect, it } from "vitest";
import type { CatalogRecord, CatalogStore } from "../../../../../amplify/lib/platform/ports";

export type MakeCatalogStore = (records: CatalogRecord[]) => CatalogStore;

const PUBLISHED: CatalogRecord = { id: "item-1", status: "PUBLISHED", demoEntryPath: "site/index.html" };
const DRAFT: CatalogRecord = { id: "item-2", status: "DRAFT" };

export function describeCatalogStoreContract(name: string, make: MakeCatalogStore) {
  describe(`CatalogStore contract: ${name}`, () => {
    it("returns the requested fields of an item, with its id", async () => {
      await expect(make([PUBLISHED, DRAFT]).get("item-1", ["status", "demoEntryPath"])).resolves.toEqual(PUBLISHED);
    });

    it("returns only the requested fields", async () => {
      await expect(make([PUBLISHED]).get("item-1", ["status"])).resolves.toEqual({ id: "item-1", status: "PUBLISHED" });
    });

    it("returns drafts as they are, for the caller to judge", async () => {
      await expect(make([PUBLISHED, DRAFT]).get("item-2", ["status", "demoEntryPath"])).resolves.toEqual(DRAFT);
    });

    it("returns undefined for an unknown id", async () => {
      await expect(make([PUBLISHED]).get("item-9", ["status"])).resolves.toBeUndefined();
    });
  });
}
