import { createContext, use } from "react";

import type { Db } from "./queries";

/** Filled by <DatabaseProvider> (provider.tsx on native, provider.web.tsx on web). */
export const DbContext = createContext<Db | null>(null);

/**
 * Typed Drizzle client for the bundled, read-only gen3.db. Must be used below
 * <DatabaseProvider>. The expo-sqlite driver is synchronous, so small queries
 * can call .get() / .all() directly during render.
 */
export function useDb(): Db {
  const db = use(DbContext);
  if (!db) throw new Error("useDb must be used inside <DatabaseProvider>");
  return db;
}
