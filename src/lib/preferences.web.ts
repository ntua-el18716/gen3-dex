/**
 * Web: localStorage (expo-sqlite's web version needs cross-origin isolation,
 * see src/db/provider.web.tsx). Storage can be unavailable (private mode,
 * blocked site data), in which case settings just don't persist.
 */
export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted.
  }
}
