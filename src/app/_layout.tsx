import "../global.css";

import { Stack } from "expo-router";

import { DatabaseProvider } from "@/db";

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <Stack />
    </DatabaseProvider>
  );
}
