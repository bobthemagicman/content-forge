#!/usr/bin/env bash
# Creates the CloudFront signing key pair for one environment (research R8, R19; quickstart §2-3).
#
#   scripts/bootstrap/create-signing-keys.sh --env <master|sandbox-<username>> --profile <p> [--rotate]
#
# - The private key goes to SSM SecureString /content-forge/<env>/cloudfront/private-key. It's
#   written only to a temporary directory outside the repo, which is deleted on exit.
# - The public key goes to SSM String /content-forge/<env>/cloudfront/public-key, which
#   amplify/backend.ts reads at synth. It isn't secret, but it belongs to one deployment, so it stays
#   out of the repo (docs/deployment/settings.md).
# - An existing key is never replaced unless --rotate is given. After rotating, deploy straight away:
#   until then the stack's key group won't accept the new signatures.
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
PUBLIC_PARAM="/content-forge/${ENV_NAME}/cloudfront/public-key"
aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

# AWS CLI history records request parameters in plain text (~/.aws/cli/history), which would
# include the private key sent to SSM.
if [[ "$(aws configure get cli_history --profile "$PROFILE" 2>/dev/null || true)" == "enabled" ]]; then
  echo "AWS CLI history is enabled for profile $PROFILE and would record the private key." >&2
  echo "Disable it first: aws configure set cli_history disabled --profile $PROFILE" >&2
  exit 1
fi

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

echo "Writing the public key to SSM $PUBLIC_PARAM..."
aws_ ssm put-parameter --name "$PUBLIC_PARAM" --type String --value "file://$WORK/public.pem" \
  --description "Content Forge ${ENV_NAME} CloudFront public key" --overwrite >/dev/null
echo "Done. Deploy ${ENV_NAME} next."
