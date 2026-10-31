#!/usr/bin/env bash
# Builds the static export and publishes it to the beta preview app on Amplify Hosting (manual
# deploys, no Git connection). The production app is the repo-connected one from tasks T026/T027.
#
# Usage: AMPLIFY_APP_ID=<id> npm run beta:deploy
# Optional: AMPLIFY_BRANCH (default beta), AWS_PROFILE, AWS_REGION (default us-west-2), SKIP_BUILD=1
set -euo pipefail

: "${AMPLIFY_APP_ID:?Set AMPLIFY_APP_ID to the ID of the beta app (aws amplify list-apps)}"
BRANCH="${AMPLIFY_BRANCH:-beta}"
export AWS_REGION="${AWS_REGION:-us-west-2}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ZIP="$(mktemp -t content-forge-beta).zip"
trap 'rm -f "$ZIP"' EXIT

cd "$ROOT"
if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  npm run build
fi
[[ -f out/index.html ]] || { echo "out/ is missing; run npm run build" >&2; exit 1; }

echo "Applying response headers and the 404 rewrite..."
aws amplify update-app --app-id "$AMPLIFY_APP_ID" \
  --custom-headers "$(cat scripts/beta/custom-headers.yml)" \
  --custom-rules '[{"source":"/<*>","target":"/404.html","status":"404-200"}]' >/dev/null

echo "Zipping out/..."
(cd out && zip -qr "$ZIP" .)

echo "Creating deployment on branch ${BRANCH}..."
read -r JOB_ID UPLOAD_URL < <(aws amplify create-deployment --app-id "$AMPLIFY_APP_ID" --branch-name "$BRANCH" \
  --query '[jobId, zipUploadUrl]' --output text)
curl --fail --silent --show-error -X PUT -H "Content-Type: application/zip" --upload-file "$ZIP" "$UPLOAD_URL"
aws amplify start-deployment --app-id "$AMPLIFY_APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" >/dev/null

echo -n "Deploying job $JOB_ID"
while true; do
  STATUS=$(aws amplify get-job --app-id "$AMPLIFY_APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" \
    --query 'job.summary.status' --output text)
  case "$STATUS" in
    SUCCEED) echo; break ;;
    FAILED | CANCELLED) echo; echo "Deployment $STATUS" >&2; exit 1 ;;
    *) echo -n "."; sleep 5 ;;
  esac
done

DOMAIN=$(aws amplify get-app --app-id "$AMPLIFY_APP_ID" --query 'app.defaultDomain' --output text)
echo "Live: https://$BRANCH.$DOMAIN/"
