# Contract: Assets CDN, Demo Host & Session Endpoint

**Consumers**: web app (images, video, demo launch links, downloads), browsers opening demos
**Provider**: `amplify/custom/assets-cdn/` (two CloudFront distributions + S3 + session Lambda). See
research R6–R8 and R20.

Two hosts:
- **Asset host** `assets.example.com`: previews, archives, and the session endpoint.
- **Demo host**: the demo distribution's own `*.cloudfront.net` name, in every environment. Template
  demos only. See "Demo host" below.

## Path behaviors

| Path | Origin | Access | Caching | Notes |
|---|---|---|---|---|
| `/v/*` | S3 (OAC) | **Signed cookies** (custom policy, resource `https://assets.example.com/v/*`) | Optimized, honors object `Cache-Control` | Thumbnails, previews, video clips. No demos |
| `/a/*` | S3 (OAC) | **Signed URL only** (canned policy, ≤ 300 s) | Disabled | Original archives. Cookies alone get `403` |
| `/_session` | Lambda function URL (OAC, `AWS_IAM`) | `X-Id-Token` header | Disabled | Issues cookies |
| `/_session/signout` | same | none | Disabled | Clears cookies |
| `/_session/demo/<id>` | same | `X-Id-Token` header | Disabled | Returns a demo launch link |
| anything else | — | — | — | `403` |

- HTTPS only, with no HTTP redirect (`https-only`: a plain-HTTP request carrying a signed URL or
  token would already have exposed it), HTTP/2 and HTTP/3. TLS 1.2+ in production, on the custom
  domain. A sandbox's asset host and every demo host use CloudFront's default certificate, which
  can't set a minimum, so they also accept TLS 1.0 and 1.1 (research R20).
- Every response carries `Strict-Transport-Security: max-age=31536000` and
  `X-Content-Type-Options: nosniff`.
- The default behavior is denied twice: a CloudFront Function answers `403`, and the trusted key
  group would refuse an unsigned request anyway.
- The asset host never serves template code: `d/` objects have no behavior here and fall to the
  default `403`.

## `GET /_session`

**Request**

```http
GET /_session HTTP/2
Host: assets.example.com
Origin: https://content.example.com
X-Id-Token: <Cognito ID token (JWT)>
```

Sent with `fetch(url, { credentials: 'include', headers: { 'X-Id-Token': idToken } })`.

**Validation (Lambda)**:
1. The `Origin` is in the allow-list: `https://content.example.com` in production,
   `http://localhost:3000` in personal sandboxes.
2. The JWT verifies (`aws-jwt-verify`): issuer = user pool, `aud` = app client ID, `token_use = id`,
   not expired.
3. `email` ends with `@example.com`, `email_verified` is not `false`, and `custom:hd` (Google's
   hosted-domain claim, research R3) is `example.com`, case-insensitively.

**Responses**

| Status | When | Headers / body |
|---|---|---|
| `204` | Valid | 3 × `Set-Cookie` (`CloudFront-Policy`, `CloudFront-Signature`, `CloudFront-Key-Pair-Id`). Production: each `Path=/v/; Secure; HttpOnly; SameSite=Lax; Max-Age=43200`, host-only (no `Domain`), so no other host receives them and they're sent only where the policy applies. Sandboxes: `SameSite=None` instead (see Environments). Body: none. Also `X-Session-Expires: <ISO time>` |
| `401` | Missing or invalid token | `{"error":"invalid_token"}` |
| `403` | Wrong domain or bad origin | `{"error":"forbidden"}` |
| `500` | Signing/config failure | `{"error":"internal"}` (logged) |

**CORS** (response headers policy + Lambda): `Access-Control-Allow-Origin: <exact origin>`,
`Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Headers: X-Id-Token`,
`Access-Control-Allow-Methods: GET`, `Access-Control-Expose-Headers: X-Session-Expires`,
`Vary: Origin`. Preflight `OPTIONS` → `204`.

## `GET /_session/demo/<id>`

Returns a launch link for one published item's demo. `<id>` is the content `id`
(`[A-Za-z0-9-]{1,64}`).

**Request**: as for `/_session` (same `Origin` and `X-Id-Token`, same validation steps 1–3). Then
the Lambda reads the item's `status` and `demoEntryPath` from the catalog table (`GetItem`, nothing
else).

**Responses**

| Status | When | Body |
|---|---|---|
| `200` | Valid, published, has a demo | `{"url":"https://<demo host>/_launch/<id>/<entry>?p=…&s=…&k=…","expiresAt":"<ISO time>"}`. `p`, `s`, `k` are the three cookie values, signed for `https://<demo host>/<id>/*` with a 12 h custom policy. Each entry path segment is percent-encoded. `Cache-Control: no-store` |
| `401`, `403` | As for `/_session` | As for `/_session` |
| `404` | No such item, a draft, or no `demoEntryPath` | `{"error":"not_found"}` |
| `500` | Catalog or signing failure, or a stored entry path that isn't a plain relative path | `{"error":"internal"}` (logged) |

No cookies are set on the asset host.

## Demo host

| Path | Origin | Access | Caching | Notes |
|---|---|---|---|---|
| `/_launch/<id>/<entry>` | none: a CloudFront Function answers | the query carries the signed values | Disabled | `302` to `/<id>/<entry>`, setting the three cookies. Bad input: `400` |
| everything else (`/<id>/**`) | S3 (OAC), origin path `/d` | **Signed cookies** scoped to the demo | Optimized, honors object `Cache-Control` | Template files from `d/<id>/**` |

- **Launch cookies**: `CloudFront-Policy`, `CloudFront-Signature`, `CloudFront-Key-Pair-Id`, each
  host-only, `Path=/<id>/; Secure; HttpOnly; SameSite=Lax; Max-Age=43200`. They're set during a
  top-level navigation, so they're first-party in every browser. Only that demo's requests carry
  them.
- The function accepts only `^/_launch/[A-Za-z0-9-]{1,64}/[^/\\].*$` and cookie values matching
  CloudFront's URL-safe base64 (`[A-Za-z0-9_~-]`). The redirect always starts with `/<id>/`, so it
  can't leave the host.
- HTTPS only, HSTS, and `nosniff`, as on the asset host. No custom domain or certificate.
- A bucket policy statement denies this distribution any object outside `d/`.
- **Expiry**: after 12 hours, demo requests get `403`. Reopening the demo from the app issues new
  cookies. Signing out of the app doesn't clear them (they belong to another site); they expire.
- **Isolation** (research R20): `*.cloudfront.net` is a public suffix, so the demo host is a
  separate site from `example.com`. Template code can't read the app's tokens, call the catalog or
  download services as the user, set cookies on `example.com`, or send same-site requests to the
  owner's other hosts. Demos share one origin, so a demo can read another demo the user opened in
  the last 12 hours (FR-027 allows this).

## `GET /_session/signout`

Returns `204` and sets the same three cookies with `Max-Age=0`. Called with
`credentials: 'include'` during sign-out (FR-006).

## Environments

This contract describes production. The demo host is the same in every environment. Personal
sandboxes (research R19) differ only in:

- **host**: the distribution's own `*.cloudfront.net` domain, which `custom.assetsBaseUrl` reports;
- **cookies**: `SameSite=None` instead of `Lax`, because `localhost` is cross-site;
- **allowed origin**: `http://localhost:3000`;
- **signing keys**: the sandbox's own key pair.

Paths, behaviors, status codes, and CORS headers are identical. Clients MUST build every asset URL
from `assetsBaseUrl` and never hard-code the host.

## Client obligations

- Call `/_session` after sign-in and before rendering any catalog image.
- Re-call it when `X-Session-Expires` is less than 60 min away (checked on focus and every 15 min),
  and after an asset load error, at most once a minute. If that call fails, ask the user to sign in
  again (FR-029).
- Open demos through a launch link, never a built URL:
  1. In the click handler, synchronously open `const tab = window.open('', '_blank')`, so the
     browser doesn't treat it as a popup, and set `tab.opener = null`, so the demo can't navigate
     the app's tab.
  2. Fetch `<assetsBaseUrl>/_session/demo/<id>` with `X-Id-Token`, as for `/_session`.
  3. On `200`, set `tab.location.href = url`. On an error, close the tab and show the error. Never
     store or log the URL.
- Build image URLs only through the `next/image` custom loader (`src/lib/assets/image-loader.ts`):
  `(src, width) → <assetsBaseUrl>/<thumbKeys[nearest(width)]>`.
