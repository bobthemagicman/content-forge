import { defineAuth, secret } from "@aws-amplify/backend";
import { APP_ORIGIN, LOCAL_ORIGIN } from "../config";
import { preSignUp } from "./pre-sign-up/resource";

/**
 * Cognito with Google Workspace as the only way in (research R3). Email login is required by
 * Amplify, but no password UI exists; the app only calls `signInWithRedirect({ provider: 'Google' })`.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret("GOOGLE_CLIENT_ID"),
        clientSecret: secret("GOOGLE_CLIENT_SECRET"),
        scopes: ["openid", "email", "profile"],
        attributeMapping: { email: "email", fullname: "name", profilePicture: "picture" },
      },
      scopes: ["OPENID", "EMAIL", "PROFILE"],
      callbackUrls: [`${APP_ORIGIN}/auth/callback/`, `${LOCAL_ORIGIN}/auth/callback/`],
      logoutUrls: [`${APP_ORIGIN}/`, `${LOCAL_ORIGIN}/`],
    },
  },
  triggers: { preSignUp },
});
