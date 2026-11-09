import { Amplify } from "aws-amplify";
import { type PlatformConfig, parseCognitoIssuer } from "@/lib/platform/config";

let configured = false;

/**
 * Configures Amplify from platform-config.json, once (T030, T132). Safe to call from every AWS
 * adapter, so call order between providers and pages doesn't matter.
 *
 * Only the user pool's hosted UI and the GraphQL endpoint are configured. No identity pool: the app
 * never uses AWS credentials (AppSync takes the user's token, and assets use cookies), and with one
 * every session read would also call Cognito Identity, where a failure would read as signed out.
 */
export function configureAmplify(config: PlatformConfig): void {
  if (configured) return;
  const { auth, catalog } = config;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: parseCognitoIssuer(auth.issuer).userPoolId,
        userPoolClientId: auth.clientId,
        loginWith: {
          oauth: {
            domain: auth.domain,
            scopes: auth.scopes,
            redirectSignIn: auth.signInRedirects,
            redirectSignOut: auth.signOutRedirects,
            responseType: "code",
            providers: [],
          },
        },
      },
    },
    // The user pool lives in another account, so AppSync checks its tokens in OIDC mode, and in that
    // mode Amplify sends the access token (amplify/data/resource.ts, research R21).
    API: { GraphQL: { endpoint: catalog.url, region: catalog.region, defaultAuthMode: "oidc" } },
  });
  configured = true;
}
