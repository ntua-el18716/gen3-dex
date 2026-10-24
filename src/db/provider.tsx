import { Asset } from "expo-asset";
import { SQLiteProvider } from "expo-sqlite";
import { Suspense, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

const DB_ASSET = require("../../assets/db/gen3.db");

/**
 * expo-sqlite copies the bundled database into app storage on first launch and
 * never overwrites an existing copy. Naming the copy after Metro's content hash
 * means a rebuilt gen3.db gets a new name, so updated installs copy it again.
 * Without a hash (shouldn't happen), fall back to overwriting on every launch.
 */
const hash = Asset.fromModule(DB_ASSET).hash;
const DB_NAME = hash ? `gen3-${hash}.db` : "gen3.db";

export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <SQLiteProvider
        databaseName={DB_NAME}
        assetSource={{ assetId: DB_ASSET, forceOverwrite: !hash }}
        useSuspense
      >
        {children}
      </SQLiteProvider>
    </Suspense>
  );
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
