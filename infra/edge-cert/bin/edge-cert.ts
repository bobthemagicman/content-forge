import { App } from "aws-cdk-lib";
import { EdgeCertStack } from "../lib/edge-cert-stack";

// Deploy once, from this folder (quickstart §2, step 1):
//   npm ci && npx cdk deploy -c assetsDomain=assets.<domain> -c hostedZoneId=<zone id> --profile <p>
// Each setting can also come from the matching environment variable used by amplify/config.ts.
const app = new App();

const setting = (key: string, env: string) => (app.node.tryGetContext(key) as string | undefined) ?? process.env[env];

const domainName = (setting("assetsDomain", "ASSETS_DOMAIN") ?? "assets.example.com").toLowerCase();
const hostedZoneId = setting("hostedZoneId", "HOSTED_ZONE_ID");
const hostedZoneName = (setting("hostedZoneName", "HOSTED_ZONE_NAME") ?? domainName.split(".").slice(1).join(".")).toLowerCase();

if (!hostedZoneId) {
  throw new Error("edge-cert: pass -c hostedZoneId=<Route 53 zone id> (or set HOSTED_ZONE_ID).");
}

new EdgeCertStack(app, "ContentForgeEdgeCert", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
  description: "Content Forge: us-east-1 certificate for the CloudFront asset host",
  domainName,
  hostedZoneId,
  hostedZoneName,
});
