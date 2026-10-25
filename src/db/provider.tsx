import { drizzle } from "drizzle-orm/expo-sqlite";
import { Asset } from "expo-asset";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { Suspense, useMemo, type ReactNode } from "react";

import { LoadingScreen } from "@/components/loading-screen";

import { DbContext } from "./context";
import * as schema from "./schema";

const DB_ASSET = require("../../assets/db/gen3.db");

/**
 * Native (Android/iOS). expo-sqlite copies the bundled database into app
 * storage on first launch and never overwrites an existing copy. Naming the
 * copy after Metro's content hash means a rebuilt gen3.db gets a new name, so
 * updated installs copy it again. Without a hash (shouldn't happen), fall back
 * to overwriting on every launch. (Web: see provider.web.tsx.)
 */
const hash = Asset.fromModule(DB_ASSET).hash;
const DB_NAME = hash ? `gen3-${hash}.db` : "gen3.db";

export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SQLiteProvider
        databaseName={DB_NAME}
        assetSource={{ assetId: DB_ASSET, forceOverwrite: !hash }}
        useSuspense
      >
        <DrizzleProvider>{children}</DrizzleProvider>
      </SQLiteProvider>
    </Suspense>
  );
}

function DrizzleProvider({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite]);
  return <DbContext value={db}>{children}</DbContext>;
}
