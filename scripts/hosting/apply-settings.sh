#!/usr/bin/env bash
# Applies the production app's response headers and 404 rewrite (research R2, R18; quickstart §2).
# Run after connecting the Amplify app, and again whenever the asset host changes; Amplify applies
# the headers from the next deploy.
#
#   ASSETS_DOMAIN=assets.<domain> scripts/hosting/apply-settings.sh --app-id <id> --profile <p>
set -euo pipefail

APP_ID=""
PROFILE=""
REGION="${AWS_REGION:-us-west-2}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-id) APP_ID="${2:-}"; shift 2 ;;
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --region) REGION="${2:-}"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$APP_ID" && -n "$PROFILE" ]] || { echo "Usage: ASSETS_DOMAIN=assets.<domain> $0 --app-id <id> --profile <p>" >&2; exit 2; }
: "${ASSETS_DOMAIN:?Set ASSETS_DOMAIN to the production asset host (assets.<domain>)}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HEADERS="$(ASSETS_DOMAIN="$ASSETS_DOMAIN" node "$ROOT/scripts/hosting/custom-headers.mjs")"

aws amplify update-app --profile "$PROFILE" --region "$REGION" --app-id "$APP_ID" \
  --custom-headers "$HEADERS" \
  --custom-rules '[{"source":"/<*>","target":"/404.html","status":"404-200"}]' >/dev/null
echo "Applied headers for $ASSETS_DOMAIN and the 404 rewrite to app $APP_ID. Redeploy master to pick them up."
