import { Storage } from "expo-sqlite/kv-store";

/**
 * Small user settings that survive restarts (native: a key-value store in
 * its own SQLite file, separate from the read-only gen3.db). Web version:
 * preferences.web.ts.
 */
export function readPreference(key: string): string | null {
  return Storage.getItemSync(key);
}

export function writePreference(key: string, value: string): void {
  Storage.setItemSync(key, value);
}
