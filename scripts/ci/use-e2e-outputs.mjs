// amplify_outputs.json is generated per environment (`ampx sandbox`, or the pipeline deploy on
// Amplify Hosting) and git-ignored, but the static export imports it at build time. Where no
// backend exists (CI, the beta preview, fresh clones) this copies the E2E fixture in its place,
// only when the file is missing (task T041).
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = join(root, "amplify_outputs.json");

if (!existsSync(target)) {
  // On Amplify Hosting the backend phase writes the real file; a stand-in there would ship a
  // front end pointed at a fake user pool.
  if (process.env.AWS_BRANCH) {
    console.error("use-e2e-outputs: amplify_outputs.json is missing on an Amplify Hosting build; the backend phase should have written it.");
    process.exit(1);
  }
  copyFileSync(join(root, "tests", "e2e", "fixtures", "amplify_outputs.e2e.json"), target);
  console.warn("use-e2e-outputs: amplify_outputs.json not found; using the E2E fixture as a stand-in.");
}
