# Contract: platform-config.json

**Consumer**: the web build (`src/lib/config.ts`, validated by `src/lib/platform/config.ts`)
**Providers**: each provider's deploy. On AWS, `scripts/platform/aws-outputs-to-config.mjs`
converts `amplify_outputs.json`; `predev`, `prebuild`, `pretest` and `typecheck` run it (T132).

The front end is a static export, so it learns about its deployment at build time from this one
file, at the repo root. It replaces the front end's direct import of `amplify_outputs.json`; the
browser ports (`AuthClient`, `CatalogClient`, plan "Ports") choose their adapters from it.

Everything in it ships to every visitor in the bundle. It never holds a secret, and git ignores it,
because it belongs to one deployment (`docs/deployment/settings.md`).

## Shape

```json
{
  "provider": "aws",
  "auth": {
    "kind": "cognito",
    "issuer": "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_AbCdEf123",
    "clientId": "…",
    "domain": "login.example.com",
    "scopes": ["openid", "email", "profile"],
    "signInRedirects": ["https://content.example.com/auth/callback/"],
    "signOutRedirects": ["https://content.example.com/"]
  },
  "catalog": { "kind": "appsync", "url": "https://….appsync-api.us-west-2.amazonaws.com/graphql", "region": "us-west-2" },
  "assets": { "baseUrl": "https://assets.example.com" }
}
```

| Field | Rule |
|---|---|
| `provider` | One of the providers the app knows: `"aws"` |
| `auth.kind` | `"cognito"`. Each kind has its own fields; the ones below are Cognito's |
| `auth.issuer` | The user pool's issuer, `https://cognito-idp.<region>.amazonaws.com/<pool id>`. The AWS adapter takes the pool ID from it |
| `auth.clientId` | The app client, non-empty |
| `auth.domain` | The hosted UI's host name, with no scheme |
| `auth.scopes` | Non-empty, and includes `openid` |
| `auth.signInRedirects`, `auth.signOutRedirects` | Non-empty lists of URLs. The broker must allow each one; the adapter uses the one on the page's origin, so one file serves `localhost:3000` and the E2E server |
| `catalog.kind` | `"appsync"`: GraphQL in OIDC mode, called with the user's access token |
| `catalog.url`, `catalog.region` | The GraphQL endpoint and its AWS region |
| `assets.baseUrl` | The asset host's origin, with no path. A trailing slash is dropped (contracts/assets-cdn.md in 001) |

**Every URL** is `https:`, except plain `http://localhost` (any port) for local development and
tests.

**Validation** happens when the bundle loads the file, at build time, so a bad file fails the build.
Every problem is reported at once. Unknown fields are ignored, so a deploy can add a field before
the app reads it. An unknown `provider` or `kind` is refused, never guessed.

The beta preview (`NEXT_PUBLIC_DEMO_MODE` on) still needs a valid file, from the E2E fixture, but
uses the demo catalog and simulated sign-in, and serves assets from `/demo`.

## Fixtures

- `tests/e2e/fixtures/amplify_outputs.e2e.json` is the fake AWS backend that CI and the beta preview
  build against. Without a backend, `scripts/ci/use-e2e-outputs.mjs` copies it into place.
- `tests/e2e/fixtures/platform-config.e2e.json` is its twin: what the converter makes of it.
  `tests/unit/platform/config.test.ts` checks that they agree, and the E2E mocks
  (`tests/e2e/fixtures/mock-backend.ts`) read their endpoints from the twin.

## Adding a provider

Add its name to `PROVIDERS`, its `auth` and `catalog` kinds to the unions in
`src/lib/platform/config.ts` with their validation, and a case to `authClient()` and
`catalogClient()` in `src/lib/platform/`. Its deploy (T144) writes the file directly.
