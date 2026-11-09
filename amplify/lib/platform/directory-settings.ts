import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SettingNotFoundError, type SettingsStore } from "./ports";

/**
 * Settings as files under `dir`, one per name (`<dir>/content-forge/auth/dev`). For tests and a
 * synth without cloud access; nothing is encrypted, so it's never used for a deployment's secrets.
 */
export function createDirectorySettings(dir: string): SettingsStore {
  return {
    async get(name) {
      let value: string;
      try {
        value = await readFile(join(dir, name), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new SettingNotFoundError(name);
        throw error;
      }
      if (!value) throw new SettingNotFoundError(name);
      return value;
    },
  };
}
