// Prints the production app's response headers as Amplify custom-header YAML (research R18).
// The CSP names the asset host, so it's built from the deployment's settings rather than committed;
// `example.com` is the same placeholder amplify/config.ts uses.
//
//   ASSETS_DOMAIN=assets.<domain> node scripts/hosting/custom-headers.mjs
import { pathToFileURL } from "node:url";

/** The research R18 policy for one asset host. */
export function contentSecurityPolicy(assetsDomain) {
  const assets = `https://${assetsDomain}`;
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${assets} https://*.googleusercontent.com`,
    `media-src ${assets}`,
    "font-src 'self'",
    `connect-src 'self' https://*.amazonaws.com https://*.amazoncognito.com ${assets}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function customHeadersYaml(assetsDomain) {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(assetsDomain)) throw new Error(`Not a host name: ${assetsDomain}`);
  const headers = [
    ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Content-Security-Policy", contentSecurityPolicy(assetsDomain)],
  ];
  return [
    "customHeaders:",
    '  - pattern: "**"',
    "    headers:",
    ...headers.flatMap(([key, value]) => [`      - key: ${key}`, `        value: ${JSON.stringify(value)}`]),
    "",
  ].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.stdout.write(customHeadersYaml((process.env.ASSETS_DOMAIN ?? "assets.example.com").toLowerCase()));
}
