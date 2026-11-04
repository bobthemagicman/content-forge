import { defineFunction } from "@aws-amplify/backend";
import { ALLOWED_EMAIL_DOMAIN } from "../../config";

export const preSignUp = defineFunction({
  name: "pre-sign-up",
  runtime: 24,
  logging: { retention: "2 weeks" },
  environment: { ALLOW_DOMAIN: ALLOWED_EMAIL_DOMAIN },
});
