#!/usr/bin/env bash
# Applies the production app's response headers and 404 rewrite (research R2, R18; quickstart §2).
# Run after connecting the Amplify app, and again whenever ASSETS_DOMAIN changes: the CSP names the
# asset host. Amplify applies the headers from the next deploy.
#
#   ASSETS_DOMAIN=assets.<domain> scripts/hosting/apply-settings.sh --app-id <id> --profile <p> [--check]
#
# --check changes nothing: it exits 1 if the app's settings differ from what this script would apply,
# for example after a console edit or a change to scripts/hosting/custom-headers.mjs.
set -euo pipefail

APP_ID=""
PROFILE=""
REGION="${AWS_REGION:-us-west-2}"
CHECK=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-id) APP_ID="${2:-}"; shift 2 ;;
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --region) REGION="${2:-}"; shift 2 ;;
    --check) CHECK=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$APP_ID" && -n "$PROFILE" ]] || { echo "Usage: ASSETS_DOMAIN=assets.<domain> $0 --app-id <id> --profile <p> [--check]" >&2; exit 2; }
: "${ASSETS_DOMAIN:?Set ASSETS_DOMAIN to the production asset host (assets.<domain>)}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HEADERS="$(ASSETS_DOMAIN="$ASSETS_DOMAIN" node "$ROOT/scripts/hosting/custom-headers.mjs")"
RULES='[{"source":"/<*>","target":"/404.html","status":"404-200"}]'
aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

if [[ "$CHECK" == "1" ]]; then
  aws_ amplify get-app --app-id "$APP_ID" --output json |
    HEADERS="$HEADERS" RULES="$RULES" node -e '
      let input = "";
      process.stdin.on("data", (chunk) => (input += chunk)).on("end", () => {
        const { app } = JSON.parse(input);
        const drift = [];
        if ((app.customHeaders ?? "").trim() !== process.env.HEADERS.trim()) drift.push("response headers");
        const pick = ({ source, target, status }) => ({ source, target, status });
        if (JSON.stringify((app.customRules ?? []).map(pick)) !== JSON.stringify(JSON.parse(process.env.RULES).map(pick))) {
          drift.push("rewrite rules");
        }
        if (drift.length) {
          console.error(`App ${app.appId}: ${drift.join(" and ")} differ from scripts/hosting. Rerun without --check to apply them.`);
          process.exit(1);
        }
        console.log(`App ${app.appId} matches scripts/hosting for ${process.env.ASSETS_DOMAIN}.`);
      });'
  exit
fi

aws_ amplify update-app --app-id "$APP_ID" --custom-headers "$HEADERS" --custom-rules "$RULES" >/dev/null
echo "Applied headers for $ASSETS_DOMAIN and the 404 rewrite to app $APP_ID. Redeploy master to pick them up."
