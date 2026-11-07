#!/usr/bin/env bash
# Creates the CloudFront signing key pair for one environment (research R8, R19; quickstart §2-3).
#
#   scripts/bootstrap/create-signing-keys.sh --env <master|sandbox-<username>> --profile <p> [--rotate]
#
# - The private key goes to SSM SecureString /content-forge/<env>/cloudfront/private-key. It's
#   written only to a temporary directory outside the repo, which is deleted on exit.
# - The public key goes to amplify/custom/assets-cdn/keys/<env>.public-key.pem. Commit it: public
#   keys aren't secret, and amplify/backend.ts reads it at synth.
# - An existing key is never replaced unless --rotate is given. After rotating, commit the new public
#   key and deploy straight away: until then the stack's key group won't accept the new signatures.
set -euo pipefail

usage() {
  echo "Usage: $0 --env <master|sandbox-<username>> --profile <aws profile> [--region <region>] [--rotate]" >&2
  exit 2
}

ENV_NAME=""
PROFILE=""
REGION="${AWS_REGION:-us-west-2}"
ROTATE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_NAME="${2:-}"; shift 2 ;;
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --region) REGION="${2:-}"; shift 2 ;;
    --rotate) ROTATE=1; shift ;;
    -h | --help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -n "$ENV_NAME" && -n "$PROFILE" ]] || usage
if [[ ! "$ENV_NAME" =~ ^(master|sandbox-[A-Za-z0-9._-]+)$ ]]; then
  echo "--env must be master or sandbox-<username> (amplify/backend.ts derives it the same way)." >&2
  exit 2
fi

for tool in aws openssl; do
  command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }
done

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PARAM="/content-forge/${ENV_NAME}/cloudfront/private-key"
PUBLIC_KEY="${ROOT}/amplify/custom/assets-cdn/keys/${ENV_NAME}.public-key.pem"
aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

if aws_ ssm get-parameter --name "$PARAM" --query Parameter.Name --output text >/dev/null 2>&1; then
  if [[ "$ROTATE" != "1" ]]; then
    echo "$PARAM already exists. Pass --rotate to replace it." >&2
    exit 1
  fi
  OVERWRITE="--overwrite"
else
  OVERWRITE="--no-overwrite"
fi

# Outside the repo, private to this user, and removed however the script exits.
umask 077
WORK="$(mktemp -d "${TMPDIR:-/tmp}/content-forge-keys.XXXXXX")"
trap 'rc=$?; rm -rf "$WORK"; exit $rc' EXIT
trap 'exit 130' INT TERM
case "$WORK" in "$ROOT"/*) echo "Refusing to write key material inside the repo ($WORK)." >&2; exit 1 ;; esac

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$WORK/private.pem" 2>/dev/null
openssl pkey -in "$WORK/private.pem" -pubout -out "$WORK/public.pem"

echo "Writing the private key to SSM $PARAM ($REGION)..."
aws_ ssm put-parameter --name "$PARAM" --type SecureString --value "file://$WORK/private.pem" \
  --description "Content Forge ${ENV_NAME} CloudFront signing key" "$OVERWRITE" >/dev/null

mkdir -p "$(dirname "$PUBLIC_KEY")"
cp "$WORK/public.pem" "$PUBLIC_KEY"
chmod 644 "$PUBLIC_KEY"
echo "Wrote ${PUBLIC_KEY#"$ROOT"/}. Commit it, then deploy."
