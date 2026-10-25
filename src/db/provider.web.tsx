import { drizzle } from "drizzle-orm/sql-js";
import { Asset } from "expo-asset";
import { Suspense, use, type ReactNode } from "react";
import initSqlJs from "sql.js/dist/sql-wasm-browser.js";
import SQL_WASM from "sql.js/dist/sql-wasm-browser.wasm";

import { LoadingScreen } from "@/components/loading-screen";

import { DbContext } from "./context";
import type { Db } from "./queries";
import * as schema from "./schema";

const DB_ASSET = require("../../assets/db/gen3.db");

/**
 * Web (a preview; the app targets Android). expo-sqlite's web version runs
 * SQLite in a worker and needs SharedArrayBuffer for its synchronous API,
 * which in turn needs cross-origin-isolation headers the dev server can't
 * send. Our database is read-only, so instead load it into sql.js — SQLite
 * compiled to WebAssembly, running synchronously on the page — and use
 * Drizzle's sql.js driver. The queries are the same either way.
 * Started once per page load; React suspends until it's ready.
 */
let loading: Promise<Db> | null = null;

async function uriOf(module: number): Promise<string> {
  const asset = await Asset.fromModule(module).downloadAsync();
  return asset.localUri ?? asset.uri;
}

function loadDb(): Promise<Db> {
  loading ??= (async () => {
    const [SQL, bytes] = await Promise.all([
      uriOf(SQL_WASM).then((wasm) => initSqlJs({ locateFile: () => wasm })),
      uriOf(DB_ASSET)
        .then((uri) => fetch(uri))
        .then((response) => response.arrayBuffer()),
    ]);
    const sqlite = new SQL.Database(new Uint8Array(bytes));
    return drizzle(sqlite, { schema });
  })();
  return loading;
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <InMemoryDb>{children}</InMemoryDb>
    </Suspense>
  );
}

function InMemoryDb({ children }: { children: ReactNode }) {
  const db = use(loadDb());
  return <DbContext value={db}>{children}</DbContext>;
}
