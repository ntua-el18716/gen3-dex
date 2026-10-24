import { drizzle } from "drizzle-orm/expo-sqlite";
import { useSQLiteContext } from "expo-sqlite";
import { useMemo } from "react";

import * as schema from "./schema";

export { DatabaseProvider } from "./provider";

/**
 * Typed Drizzle client for the bundled, read-only gen3.db. Must be used below
 * <DatabaseProvider>. The expo-sqlite driver is synchronous, so small queries
 * can call .get() / .all() directly during render.
 */
export function useDb() {
  const sqlite = useSQLiteContext();
  return useMemo(() => drizzle(sqlite, { schema }), [sqlite]);
}

export type Db = ReturnType<typeof useDb>;
