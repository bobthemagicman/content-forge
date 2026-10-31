import { describe, expect, it } from "vitest";
import { CONTENT_TYPES, labelFor, rowNumber, typeFromRouteSlug } from "@/lib/content-types";
import { getBySlug, listRow } from "@/lib/data/content";

describe("content types", () => {
  it("keeps the fixed row order (FR-007)", () => {
    expect(CONTENT_TYPES.map((t) => t.routeSlug)).toEqual([
      "website-templates",
      "powerpoint-templates",
      "video",
      "images",
      "textures",
      "other",
    ]);
  });

  it("maps route slugs both ways", () => {
    expect(typeFromRouteSlug("textures")).toBe("TEXTURE");
    expect(typeFromRouteSlug("nope")).toBeUndefined();
    expect(labelFor("POWERPOINT_TEMPLATE")).toBe("PowerPoint Templates");
    expect(rowNumber("VIDEO")).toBe("03");
  });
});

describe("demo catalog source", () => {
  it("lists published items newest first and never drafts", async () => {
    const { items } = await listRow("WEBSITE_TEMPLATE");
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.slug === "unreleased-draft-template")).toBe(false);
    expect(items[0].slug).toBe("halcyon-saas-landing-page");
  });

  it("pages with nextToken", async () => {
    const first = await listRow("VIDEO", { limit: 4 });
    expect(first.items).toHaveLength(4);
    expect(first.nextToken).not.toBeNull();
    const second = await listRow("VIDEO", { limit: 4, nextToken: first.nextToken });
    expect(second.nextToken).toBeNull();
    expect(new Set([...first.items, ...second.items].map((i) => i.id)).size).toBe(first.items.length + second.items.length);
  });

  it("hides drafts and unknown slugs from the detail page", async () => {
    expect(await getBySlug("unreleased-draft-template")).toBeNull();
    expect(await getBySlug("does-not-exist")).toBeNull();
    expect((await getBySlug("kraft-paper-4k"))?.title).toBe("Kraft Paper, 4K");
  });
});
