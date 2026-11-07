import { Amplify } from "aws-amplify";
import outputs from "@/../amplify_outputs.json";

let configured = false;

/**
 * Configures Amplify from this environment's outputs, once (T030). Safe to call from every module
 * that needs Amplify, so call order between providers and pages doesn't matter.
 *
 * The identity pool is left out. The app never uses AWS credentials (AppSync takes the user-pool
 * token, and assets use cookies), and with an identity pool every `fetchAuthSession()` also calls
 * Cognito Identity, even for signed-out visitors, and a failure there would read as signed out.
 */
export function configureAmplify(): void {
  if (configured) return;
  Amplify.configure({ ...outputs, auth: { ...outputs.auth, identity_pool_id: undefined } });
  configured = true;
}

/** The asset plane's base URL (`custom.assetsBaseUrl`), or undefined until T025 adds it. */
export function assetsBaseUrl(): string | undefined {
  const custom = (outputs as { custom?: { assetsBaseUrl?: string } }).custom;
  return custom?.assetsBaseUrl?.replace(/\/$/, "");
}
