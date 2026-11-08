import { type ClientSchema, a } from "@aws-amplify/backend";

/**
 * The catalog (data-model.md, contracts/data-api.md, research R4).
 *
 * Signed-in users can only read, and only through the two index queries: the model's default
 * `getContent`/`listContents` queries would return drafts, and every write comes from ingest or the
 * download function, so all generated operations are disabled.
 *
 * Both indexes are sparse, keyed on attributes that only published items carry, so neither query can
 * return a draft. Amplify generates a public query for every index, so there's deliberately no index
 * on `slug` itself; ingest checks slug uniqueness against the table directly.
 */
export const schema = a.schema({
  // Row order, which is also the display order (FR-007). Kept in step with `src/lib/content-types.ts`
  // by tests/unit/data/schema.test.ts.
  ContentType: a.enum(["WEBSITE_TEMPLATE", "POWERPOINT_TEMPLATE", "VIDEO", "IMAGE", "TEXTURE", "OTHER"]),
  ContentStatus: a.enum(["DRAFT", "PUBLISHED"]),
  LicenseType: a.enum(["REGULAR", "EXTENDED", "OTHER", "UNKNOWN"]),

  Content: a
    .model({
      slug: a.string().required(),
      // Equal to `slug` on published items and absent on drafts: the key of the sparse slug index.
      publishedSlug: a.string(),
      title: a.string().required(),
      type: a.ref("ContentType").required(),
      status: a.ref("ContentStatus").required(),
      // Absent (not null) on drafts, which keeps them out of the sparse type index.
      publishedAt: a.datetime(),
      description: a.string(),
      tags: a.string().required().array(),
      sourceMarketplace: a.string(),
      sourceUrl: a.url(),
      externalDemoUrl: a.url(),
      licenseType: a.ref("LicenseType").required(),
      purchaseDate: a.date(),
      archiveKey: a.string().required(),
      archiveFileName: a.string().required(),
      // Float, because GraphQL `Int` is 32-bit and archives can be several GB.
      archiveBytes: a.float().required(),
      demoEntryPath: a.string(),
      accentColor: a.string(),
      thumbKeys: a.json().required(),
      previewKeys: a.string().required().array(),
      videoPreviewKey: a.string(),
      posterKey: a.string(),
      meta: a.json(),
      downloadCount: a.integer().required(),
    })
    .secondaryIndexes((index) => [
      index("publishedSlug").queryField("listContentBySlug"),
      index("type").sortKeys(["publishedAt"]).queryField("listContentByTypeAndPublishedAt"),
    ])
    .disableOperations(["mutations", "subscriptions", "queries"])
    // Tokens come from the user pool in the auth account, through OIDC (research R21).
    .authorization((allow) => [allow.authenticated("oidc").to(["read"])]),
});

export type Schema = ClientSchema<typeof schema>;
