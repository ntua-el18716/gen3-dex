import "../global.css";

import { Stack } from "expo-router";

import { DatabaseProvider } from "@/db";
import { CurrentGameProvider } from "@/state/current-game";

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <CurrentGameProvider>
        <Stack />
      </CurrentGameProvider>
    </DatabaseProvider>
  );
}
