// AppSync, through the Amplify GraphQL client: the AWS adapter for the CatalogClient port (T135).
// T084 and T096 build `createAppSyncCatalog()` here from the operations in contracts/data-api.md,
// as named GraphQL documents sent with `client.graphql()`. platform-config.json carries only the
// endpoint, not Amplify's model introspection, so `client.models` isn't available.

import { generateClient } from "aws-amplify/api";
import type { PlatformConfig } from "@/lib/platform/config";
import { configureAmplify } from "./amplify";

/**
 * The part of Amplify's client the adapter uses. Amplify's own client type is too deep for tsc to
 * compare (TS2321), so it's narrowed here.
 */
export interface GraphQLClient {
  graphql<T>(options: { query: string; variables?: Record<string, unknown> }): Promise<{ data: T }>;
}

let client: GraphQLClient | undefined;

/**
 * The shared client, created on first use so nothing calls AppSync before sign-in. OIDC mode: the
 * user pool lives in another account (amplify/data/resource.ts, research R21), and Amplify sends the
 * access token.
 */
export function graphqlClient(config: PlatformConfig): GraphQLClient {
  configureAmplify(config);
  client ??= generateClient({ authMode: "oidc" }) as unknown as GraphQLClient;
  return client;
}
