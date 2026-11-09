// Writes platform-config.json, the provider-neutral settings the web build reads (T132,
// specs/003-portable-deployment/contracts/platform-config.md), from Amplify's amplify_outputs.json.
// `predev`, `prebuild` and `typecheck` run it after scripts/ci/use-e2e-outputs.mjs, so the file
// always matches the outputs beside it. The app validates the result when it loads
// (src/lib/platform/config.ts), so a bad file fails the build.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {any} outputs the parsed amplify_outputs.json
 * @returns {import("../../src/lib/platform/config").PlatformConfig}
 */
export function toPlatformConfig(outputs) {
  const auth = outputs?.auth;
  const data = outputs?.data;
  const missing = [
    ["auth.aws_region", auth?.aws_region],
    ["auth.user_pool_id", auth?.user_pool_id],
    ["auth.user_pool_client_id", auth?.user_pool_client_id],
    ["auth.oauth", auth?.oauth],
    ["data.url", data?.url],
    ["data.aws_region", data?.aws_region],
    ["custom.assetsBaseUrl", outputs?.custom?.assetsBaseUrl],
  ]
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);
  if (missing.length) throw new Error(`amplify_outputs.json has no ${missing.join(", ")}; deploy the backend first.`);

  return {
    provider: "aws",
    auth: {
      kind: "cognito",
      issuer: `https://cognito-idp.${auth.aws_region}.amazonaws.com/${auth.user_pool_id}`,
      clientId: auth.user_pool_client_id,
      domain: auth.oauth.domain,
      scopes: auth.oauth.scopes,
      signInRedirects: auth.oauth.redirect_sign_in_uri,
      signOutRedirects: auth.oauth.redirect_sign_out_uri,
    },
    catalog: { kind: "appsync", url: data.url, region: data.aws_region },
    assets: { baseUrl: String(outputs.custom.assetsBaseUrl).replace(/\/$/, "") },
  };
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const source = join(root, "amplify_outputs.json");
  const target = join(root, "platform-config.json");
  if (!existsSync(source)) {
    console.error("aws-outputs-to-config: amplify_outputs.json is missing; run scripts/ci/use-e2e-outputs.mjs or deploy the backend.");
    process.exit(1);
  }
  const config = toPlatformConfig(JSON.parse(readFileSync(source, "utf8")));
  writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
