import { defineAuth, secret } from "@aws-amplify/backend";
import { APP_ORIGIN, GOOGLE_PROVIDER_NAME, LOCAL_ORIGIN } from "../config";
import { preSignUp } from "./pre-sign-up/resource";

/**
 * Cognito with Google Workspace as the only way in (research R3). Email login is required by
 * Amplify, but no password UI exists; the app only calls `signInWithRedirect` for this provider.
 *
 * Google is registered as a generic OIDC provider, not Cognito's built-in Google provider: for OIDC
 * providers Cognito validates Google's ID token and maps claims from it and from Google's userinfo
 * response, which carry `hd`, the user's Workspace domain. The built-in provider reads the People
 * API, which has no `hd`. Consumer Google accounts have no `hd`, so the attribute stays empty and
 * the pre-sign-up trigger and the session function refuse them.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      oidc: [
        {
          name: GOOGLE_PROVIDER_NAME,
          clientId: secret("GOOGLE_CLIENT_ID"),
          clientSecret: secret("GOOGLE_CLIENT_SECRET"),
          issuerUrl: "https://accounts.google.com",
          scopes: ["openid", "email", "profile"],
          attributeMapping: {
            email: "email",
            emailVerified: "email_verified",
            fullname: "name",
            profilePicture: "picture",
            custom: { "custom:hd": "hd" },
          },
        },
      ],
      scopes: ["OPENID", "EMAIL", "PROFILE"],
      callbackUrls: [`${APP_ORIGIN}/auth/callback/`, `${LOCAL_ORIGIN}/auth/callback/`],
      logoutUrls: [`${APP_ORIGIN}/`, `${LOCAL_ORIGIN}/`],
    },
  },
  userAttributes: {
    // Google's hosted-domain claim. Mutable, because Cognito rewrites mapped attributes on every
    // federated sign-in.
    "custom:hd": { dataType: "String", mutable: true, maxLen: 253 },
  },
  triggers: { preSignUp },
});
