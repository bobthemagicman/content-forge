// @vitest-environment node
import { describe, expect, it } from "vitest";
import { schema } from "../../../amplify/data/resource";
import { CONTENT_TYPES } from "@/lib/content-types";

const sdl = schema.transform().schema;

function enumValues(name: string): string[] {
  const body = sdl.match(new RegExp(`enum ${name} \\{([^}]*)\\}`))?.[1] ?? "";
  return body.split(/\s+/).filter(Boolean);
}

describe("catalog schema (data-model.md, research R4)", () => {
  it("lists content types in the front end's row order", () => {
    expect(enumValues("ContentType")).toEqual(CONTENT_TYPES.map((t) => t.type));
  });

  it("has the status and license enums", () => {
    expect(enumValues("ContentStatus")).toEqual(["DRAFT", "PUBLISHED"]);
    expect(enumValues("LicenseType")).toEqual(["REGULAR", "EXTENDED", "OTHER", "UNKNOWN"]);
  });

  it("exposes no generated operations, and only read access for signed-in users", () => {
    expect(sdl).toContain("@model(mutations:null,subscriptions:null,queries:null)");
    expect(sdl).toContain("@auth(rules: [{allow: private, operations: [read]}])");
  });

  it("defines only sparse indexes, so no query can return a draft", () => {
    // Every index gets a public query, so `slug` itself must stay unindexed.
    expect(sdl).toMatch(/\n {2}slug: String!\n/);
    expect(sdl).toMatch(/publishedSlug: String @index\(queryField: "listContentBySlug"\)/);
    expect(sdl.match(/@index\(/g)).toHaveLength(2);
    expect(sdl).toMatch(
      /type: ContentType! @index\(sortKeyFields: \["publishedAt"\], queryField: "listContentByTypeAndPublishedAt"\)/,
    );
    // Optional, so drafts can leave both keys out and stay out of both indexes.
    expect(sdl).toMatch(/publishedAt: AWSDateTime\n/);
    expect(sdl).toMatch(/publishedSlug: String @/);
  });
});
