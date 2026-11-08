#!/usr/bin/env bash
# Deploys one user pool to the auth account and writes its handover file (research R21,
# quickstart §2).
#
#   ALLOWED_EMAIL_DOMAIN=<domain> scripts/auth/deploy.sh --env dev --profile <auth account profile>
#   ALLOWED_EMAIL_DOMAIN=<domain> APP_ORIGIN=https://content.<domain> scripts/auth/deploy.sh --env prod --profile <p>
#
# `dev` serves every personal sandbox (on localhost); `prod` serves master. The handover file,
# amplify/auth-environments/<env>.json, holds the pool's IDs and domain, which the app's backend
# reads at synth. Commit it: none of it is secret, and the front end ships the same values.
set -euo pipefail

usage() {
  echo "Usage: $0 --env <dev|prod> --profile <aws profile>" >&2
  exit 2
}

AUTH_ENV=""
PROFILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) AUTH_ENV="${2:-}"; shift 2 ;;
    --profile) PROFILE="${2:-}"; shift 2 ;;
    -h | --help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done
[[ -n "$AUTH_ENV" && -n "$PROFILE" ]] || usage
[[ "$AUTH_ENV" == "dev" || "$AUTH_ENV" == "prod" ]] || { echo "--env must be dev or prod." >&2; exit 2; }
[[ -n "${ALLOWED_EMAIL_DOMAIN:-}" ]] || { echo "Set ALLOWED_EMAIL_DOMAIN to the Workspace domain." >&2; exit 2; }
if [[ "$AUTH_ENV" == "prod" && -z "${APP_ORIGIN:-}" ]]; then
  echo "Set APP_ORIGIN (https://content.<domain>) for prod." >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STACK="ContentForgeAuth-${AUTH_ENV}"
HANDOVER="${ROOT}/amplify/auth-environments/${AUTH_ENV}.json"

if ! aws secretsmanager describe-secret --profile "$PROFILE" --region us-west-2 \
  --secret-id content-forge/google-oauth-client --query Name --output text >/dev/null 2>&1; then
  echo "The Google client secret isn't in this account yet. Run scripts/auth/set-google-secret.sh --profile $PROFILE first." >&2
  exit 1
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/content-forge-auth.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT/infra/auth"
[[ -d node_modules ]] || npm ci --no-audit --no-fund
npx cdk deploy "$STACK" -c env="$AUTH_ENV" --profile "$PROFILE" --outputs-file "$WORK/outputs.json"

STACK="$STACK" node -e '
  const fs = require("node:fs");
  const out = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))[process.env.STACK];
  const handover = {
    region: out.Region,
    userPoolId: out.UserPoolId,
    userPoolClientId: out.UserPoolClientId,
    domain: out.Domain,
    appOrigin: out.AppOrigin,
  };
  fs.writeFileSync(process.argv[2], JSON.stringify(handover, null, 2) + "\n");
  console.log(`\nWrote ${process.argv[2]}. Commit it.`);
  console.log(`Google OAuth client: add the authorized redirect URI ${out.GoogleRedirectUri} if it is not there yet.`);
' "$WORK/outputs.json" "$HANDOVER"
