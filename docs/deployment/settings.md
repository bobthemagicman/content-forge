# Deployment settings

This repo is public and meant to be reused, so it holds code, scripts and `example.com`
placeholders only. Everything that identifies one deployment (its domains, accounts, user pool,
keys) is provided by that deployment and lives in its own cloud accounts (research R22). This page
lists every such setting: what it is, who provides it, and where it lives on AWS today.

The names in the first column are provider-neutral. They're the contract a deployment on another
cloud provider fills in too ([portable deployment plan](../../specs/003-portable-deployment/plan.md)).

**Never commit any of these values.** CI and reviews look for account IDs, pool and client IDs,
real domains and key material.

## Settings a deployment provides

| Setting | What it is | Secret? | Where it lives on AWS | Set by |
|---|---|---|---|---|
| `environment` | `master` (production) or `sandbox-<name>` (one developer) | No | `AWS_BRANCH` on Amplify Hosting; otherwise `sandbox-<OS user>` | The platform |
| `region` | Where the app's resources go | No | The AWS profile, or `AWS_REGION` | The deployer |
| `appOrigin` | The production web origin, `https://content.<domain>` | No | Amplify env var `APP_ORIGIN`. Sandboxes use `http://localhost:3000` | Owner, once |
| `assetsDomain` | The production asset host, `assets.<domain>` | No | Amplify env vars `ASSETS_DOMAIN`, `HOSTED_ZONE_NAME` | Owner, once |
| `allowedEmailDomain` | The Google Workspace domain whose accounts may sign in | No | Part of `identity` below: the auth stack's pre-sign-up trigger, and the session function reads it from the handover | `ALLOWED_EMAIL_DOMAIN=<domain> scripts/auth/deploy.sh` |
| `budgetAlertEmail` | Where the monthly budget alert goes | No (personal data) | Amplify env var `BUDGET_ALERT_EMAIL` | Owner, once |
| `identityProvider.client` | The Google OAuth client ID and secret | **Yes** | Secrets Manager `content-forge/google-oauth-client`, auth account | `scripts/auth/set-google-secret.sh` |
| `identity` | The token issuer, client ID, sign-in domain, redirect origin and allowed email domain the app trusts | No | SSM String `/content-forge/auth/<dev\|prod>`, app account (JSON) | `scripts/auth/deploy.sh` |
| `assetSigning.privateKey` | Signs asset cookies, download URLs and demo launch links | **Yes** | SSM SecureString `/content-forge/<env>/cloudfront/private-key` | `scripts/bootstrap/create-signing-keys.sh` |
| `assetSigning.publicKey` | Verifies them | No | SSM String `/content-forge/<env>/cloudfront/public-key` | `scripts/bootstrap/create-signing-keys.sh` |
| `fonts` | Where the licensed font files are kept | No | Amplify env var `FONTS_S3_URI` | Owner, once |

AWS-only settings, with no counterpart elsewhere:

| Setting | Where it lives | Set by |
|---|---|---|
| Edge certificate ARN | Amplify env var `ASSETS_CERT_ARN` | `infra/edge-cert` output |
| Route 53 zone ID | Amplify env var `HOSTED_ZONE_ID` | Owner, once |
| Amplify app ID | `AMPLIFY_APP_ID` in the shell, for `scripts/beta/deploy.sh` | Owner |
| Account IDs and AWS profile names | Nowhere in the repo: every script takes `--profile` | The deployer |

## What a deployment hands to the web app

The front end is a static export, so the settings it needs are baked in at build time from the
backend's outputs (`amplify_outputs.json` on AWS, which git ignores). None of these are secret:
the bundle ships them to every visitor.

| Output | What it is |
|---|---|
| Identity | Issuer or pool, client ID, sign-in domain, scopes, redirect URIs |
| Catalog API | Endpoint URL and auth mode |
| `assetsBaseUrl` | The asset host, for previews, `/_session` and demo launch links |

## How synth finds them

`amplify/parameters.ts` reads the SSM values at synth with the deploying credentials, so
`ampx sandbox` and Amplify Hosting need no extra setup beyond the service role's
`ssm:GetParameter` on `/content-forge/*`. The synthesized templates contain the values, but they
stay in `cdk.out` (ignored) and the deploying account.

For tests or an offline synth, set `CONTENT_FORGE_PARAMETERS_DIR` to a directory that mirrors the
parameter names (for example `<dir>/content-forge/auth/dev`). `tests/infra/backend-auth.test.ts`
does that.

## Keeping your settings in git (optional)

If you want your deployment's settings versioned, keep them in a **private** repo of your own: one
file per deployment, plus a script that writes them to SSM and the Amplify app. Don't put them in a
fork of this repo, and don't commit them here.
