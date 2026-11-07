# Contract: Assets CDN & Session Endpoint (`assets.example.com`)

**Consumers**: web app (images, video, demos, downloads), browsers opening demos
**Provider**: `amplify/custom/assets-cdn/` (CloudFront + S3 + session Lambda). See research R6–R8.

## Path behaviors

| Path | Origin | Access | Caching | Notes |
|---|---|---|---|---|
| `/v/*` | S3 (OAC) | **Signed cookies** (custom policy, resource `https://assets.example.com/v/*`) | Optimized, honors object `Cache-Control` | Thumbnails, previews, video clips, demos |
| `/a/*` | S3 (OAC) | **Signed URL only** (canned policy, ≤ 300 s) | Disabled | Original archives. Cookies alone get `403` |
| `/_session` | Lambda function URL (OAC, `AWS_IAM`) | `X-Id-Token` header | Disabled | Issues cookies |
| `/_session/signout` | same | none | Disabled | Clears cookies |
| anything else | — | — | — | `403` |

- HTTPS only, with no HTTP redirect (`https-only`: a plain-HTTP request carrying a signed URL or
  token would already have exposed it), TLS 1.2+, HTTP/2 and HTTP/3.
- Every response carries `Strict-Transport-Security: max-age=31536000` and
  `X-Content-Type-Options: nosniff`.
- The default behavior is denied twice: a CloudFront Function answers `403`, and the trusted key
  group would refuse an unsigned request anyway.
- Demo pages under `/v/<id>/demo/**` are third-party code. They're same-site with the app but
  **cross-origin**, so they can't read `content.example.com` storage. The app sets no cookies on
  `.example.com`.
- **Accepted risk (2026-11-07):** because demo scripts run on `assets.example.com`, a malicious
  template could set cookies on `.example.com`, send same-site requests to other `*.example.com`
  apps, show a fake sign-in page on a trusted host, or read other catalog previews. Serving demos
  from a separate registrable domain would remove this; the owner chose not to. Import only
  templates from trusted marketplaces. A restrictive CSP on `/v/*/demo/*` is a possible later
  mitigation, to be tested on a sandbox first.

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
3. `email` ends with `@example.com` and `email_verified` is not `false`.

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

## `GET /_session/signout`

Returns `204` and sets the same three cookies with `Max-Age=0`. Called with
`credentials: 'include'` during sign-out (FR-006).

## Environments

This contract describes production. Personal sandboxes (research R19) differ only in:

- **host**: the distribution's own `*.cloudfront.net` domain, which `custom.assetsBaseUrl` reports;
- **cookies**: `SameSite=None` instead of `Lax`, because `localhost` is cross-site;
- **allowed origin**: `http://localhost:3000`;
- **signing keys**: the sandbox's own key pair.

Paths, behaviors, status codes, and CORS headers are identical. Clients MUST build every asset URL
from `assetsBaseUrl` and never hard-code the host.

## Client obligations

- Call `/_session` after sign-in and before rendering any catalog image.
- Re-call it when `X-Session-Expires` is less than 60 min away (checked on focus and every 15 min),
  and once after the first asset load error. If the retry also fails, ask the user to sign in again
  (FR-029).
- Open demos with
  `window.open('<assetsBaseUrl>/v/<id>/demo/<demoEntryPath>', '_blank', 'noopener')`.
- Build image URLs only through the `next/image` custom loader (`src/lib/assets/image-loader.ts`):
  `(src, width) → <assetsBaseUrl>/<thumbKeys[nearest(width)]>`.
