import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { preSignUp } from "./auth/pre-sign-up/resource";

// Auth only for now. T025 adds `data`, the environment name (research R19), the `assets` stack,
// and the custom outputs.
const backend = defineBackend({ auth, preSignUp });

const { cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources;

// No self-service sign-up; accounts come only from federated Google sign-in, which the pre-sign-up
// trigger limits to the allowed domain (research R3). Verify in T054 that first-time Google sign-in
// still works with this on; if it doesn't, remove it.
cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true };

// Refresh tokens last 7 days (research R3).
cfnUserPoolClient.refreshTokenValidity = 7;
cfnUserPoolClient.tokenValidityUnits = { refreshToken: "days" };
