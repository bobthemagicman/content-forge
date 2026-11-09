import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/../amplify/data/schema";
import { configureAmplify } from "@/lib/auth/amplify-config";

// The AppSync client for catalog reads (T031, contracts/data-api.md). The user pool lives in another
// account, so AppSync checks its tokens in OIDC mode (amplify/data/resource.ts, research R21), and in
// that mode Amplify sends the Cognito access token. T084 and T096 are its callers.

export type DataClient = ReturnType<typeof generateClient<Schema>>;

let client: DataClient | undefined;

/** The shared client, created on first use so that nothing calls AppSync before sign-in. */
export function dataClient(): DataClient {
  configureAmplify();
  client ??= generateClient<Schema>({ authMode: "oidc" });
  return client;
}
