#!/usr/bin/env bash
# Deploys one user pool to the auth account and hands its settings to the app account (research
# R21, quickstart §2).
#
#   ALLOWED_EMAIL_DOMAIN=<domain> scripts/auth/deploy.sh --env dev \
#     --auth-profile <auth account profile> --app-profile <app account profile>
#   ALLOWED_EMAIL_DOMAIN=<domain> APP_ORIGIN=https://content.<domain> scripts/auth/deploy.sh --env prod ...
#
# `dev` serves every personal sandbox (on localhost); `prod` serves master. The pool's IDs, domain
# and redirect origin go to the SSM String /content-forge/auth/<env> in the app account, which the
# app's backend reads at synth (amplify/auth-environment.ts). None of it is secret, but it belongs to
# this deployment, so it never goes in the repo (docs/deployment/settings.md).
set -euo pipefail

usage() {
  echo "Usage: $0 --env <dev|prod> --auth-profile <p> --app-profile <p> [--region <r>] [--app-region <r>]" >&2
  exit 2
}

AUTH_ENV=""
AUTH_PROFILE=""
APP_PROFILE=""
REGION="${AWS_REGION:-us-west-2}"
APP_REGION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) AUTH_ENV="${2:-}"; shift 2 ;;
    --auth-profile) AUTH_PROFILE="${2:-}"; shift 2 ;;
    --app-profile) APP_PROFILE="${2:-}"; shift 2 ;;
    --region) REGION="${2:-}"; shift 2 ;;
    --app-region) APP_REGION="${2:-}"; shift 2 ;;
    -h | --help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done
APP_REGION="${APP_REGION:-$REGION}"
[[ -n "$AUTH_ENV" && -n "$AUTH_PROFILE" && -n "$APP_PROFILE" ]] || usage
[[ "$AUTH_ENV" == "dev" || "$AUTH_ENV" == "prod" ]] || { echo "--env must be dev or prod." >&2; exit 2; }
[[ -n "${ALLOWED_EMAIL_DOMAIN:-}" ]] || { echo "Set ALLOWED_EMAIL_DOMAIN to the Workspace domain." >&2; exit 2; }
if [[ "$AUTH_ENV" == "prod" && -z "${APP_ORIGIN:-}" ]]; then
  echo "Set APP_ORIGIN (https://content.<domain>) for prod." >&2
  exit 2
fi
command -v aws >/dev/null || { echo "aws is required" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STACK="ContentForgeAuth-${AUTH_ENV}"
PARAM="/content-forge/auth/${AUTH_ENV}"

# Fail before deploying anything if either profile can't be used.
for profile in "$AUTH_PROFILE" "$APP_PROFILE"; do
  aws sts get-caller-identity --profile "$profile" --query Account --output text >/dev/null ||
    { echo "Profile $profile has no valid credentials (expired SSO session? aws sso login --profile $profile)." >&2; exit 1; }
done

if ! aws secretsmanager describe-secret --profile "$AUTH_PROFILE" --region "$REGION" \
  --secret-id content-forge/google-oauth-client --query Name --output text >/dev/null 2>&1; then
  echo "The Google client secret isn't in the auth account yet." >&2
  echo "Run scripts/auth/set-google-secret.sh --profile $AUTH_PROFILE --region $REGION first." >&2
  exit 1
fi

# Outside the repo, so the outputs can't be committed by accident.
umask 077
WORK="$(mktemp -d "${TMPDIR:-/tmp}/content-forge-auth.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT/infra/auth"
[[ -d node_modules ]] || npm ci --no-audit --no-fund
AUTH_REGION="$REGION" npx cdk deploy "$STACK" -c env="$AUTH_ENV" --profile "$AUTH_PROFILE" \
  --outputs-file "$WORK/outputs.json"

STACK="$STACK" node -e '
  const fs = require("node:fs");
  const out = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))[process.env.STACK];
  const handover = {
    region: out.Region,
    userPoolId: out.UserPoolId,
    userPoolClientId: out.UserPoolClientId,
    domain: out.Domain,
    appOrigin: out.AppOrigin,
    allowedEmailDomain: out.AllowedEmailDomain,
  };
  fs.writeFileSync(process.argv[2], JSON.stringify(handover));
  fs.writeFileSync(process.argv[3], out.GoogleRedirectUri);
' "$WORK/outputs.json" "$WORK/handover.json" "$WORK/redirect-uri"

echo "Writing the pool settings to SSM $PARAM in the app account ($APP_REGION)..."
aws ssm put-parameter --profile "$APP_PROFILE" --region "$APP_REGION" --name "$PARAM" --type String \
  --value "file://$WORK/handover.json" --overwrite \
  --description "Content Forge ${AUTH_ENV} user pool (scripts/auth/deploy.sh)" >/dev/null

echo
echo "Done. Deployments in the app account now sign in through the ${AUTH_ENV} pool."
echo "Google OAuth client: add the authorized redirect URI $(cat "$WORK/redirect-uri") if it is not there yet."
