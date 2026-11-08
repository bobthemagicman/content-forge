#!/usr/bin/env bash
# Stores the Google OAuth client in the auth account's Secrets Manager (research R21, quickstart §2).
#
#   scripts/auth/set-google-secret.sh --profile <auth account profile>
#
# It prompts for the client ID and secret, so neither lands in shell history or on screen. The
# user pool's Google provider reads the secret `content-forge/google-oauth-client` when CloudFormation
# deploys it (infra/auth/lib/auth-stack.ts). Rerun it to change the secret, then redeploy both pools.
set -euo pipefail

usage() {
  echo "Usage: $0 --profile <aws profile> [--region <region>]" >&2
  exit 2
}

PROFILE=""
REGION="us-west-2"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --region) REGION="${2:-}"; shift 2 ;;
    -h | --help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done
[[ -n "$PROFILE" ]] || usage
command -v aws >/dev/null || { echo "aws is required" >&2; exit 1; }
command -v node >/dev/null || { echo "node is required" >&2; exit 1; }

SECRET_ID="content-forge/google-oauth-client"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

# AWS CLI history records request parameters in plain text (~/.aws/cli/history).
if [[ "$(aws configure get cli_history --profile "$PROFILE" 2>/dev/null || true)" == "enabled" ]]; then
  echo "AWS CLI history is enabled for profile $PROFILE and would record the client secret." >&2
  echo "Disable it first: aws configure set cli_history disabled --profile $PROFILE" >&2
  exit 1
fi

read -r -p "Google OAuth client ID: " CLIENT_ID
read -r -s -p "Google OAuth client secret (not shown): " CLIENT_SECRET
echo
[[ "$CLIENT_ID" == *.apps.googleusercontent.com ]] || { echo "That doesn't look like a Google client ID." >&2; exit 1; }
[[ -n "$CLIENT_SECRET" ]] || { echo "The client secret is empty." >&2; exit 1; }

# The value goes through a private temporary file, never a command line (visible in `ps`).
umask 077
WORK="$(mktemp -d "${TMPDIR:-/tmp}/content-forge-google.XXXXXX")"
trap 'rc=$?; rm -rf "$WORK"; exit $rc' EXIT
trap 'exit 130' INT TERM
case "$WORK" in "$ROOT"/*) echo "Refusing to write the secret inside the repo ($WORK)." >&2; exit 1 ;; esac
CLIENT_ID="$CLIENT_ID" CLIENT_SECRET="$CLIENT_SECRET" node -e \
  'process.stdout.write(JSON.stringify({ clientId: process.env.CLIENT_ID, clientSecret: process.env.CLIENT_SECRET }))' \
  > "$WORK/secret.json"
unset CLIENT_SECRET

if aws_ secretsmanager describe-secret --secret-id "$SECRET_ID" --query Name --output text >/dev/null 2>&1; then
  aws_ secretsmanager put-secret-value --secret-id "$SECRET_ID" --secret-string "file://$WORK/secret.json" \
    --query VersionId --output text >/dev/null
  echo "Updated $SECRET_ID. Redeploy both pools (scripts/auth/deploy.sh) so they pick it up."
else
  aws_ secretsmanager create-secret --name "$SECRET_ID" \
    --description "Content Forge: Google OAuth client for the Cognito user pools" \
    --secret-string "file://$WORK/secret.json" --query Name --output text >/dev/null
  echo "Created $SECRET_ID."
fi
