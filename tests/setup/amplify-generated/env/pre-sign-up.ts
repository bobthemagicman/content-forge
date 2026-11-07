// Committed stand-in for `.amplify/generated/env/pre-sign-up.ts`, which only exists after `ampx
// sandbox` or a pipeline deploy. Type-checking and unit tests resolve `$amplify/*` here (T005).
export const env = process.env as NodeJS.ProcessEnv & { ALLOW_DOMAIN: string };
