import { useCallback, useState } from "react";

import { readPreference, writePreference } from "@/lib/preferences";

/** Where the sprite sits on the Pokédex list cards (both designs were liked). */
export const LIST_LAYOUTS = ["sprite-right", "sprite-left"] as const;
export type ListLayout = (typeof LIST_LAYOUTS)[number];

const PREFERENCE_KEY = "listLayout";

/** The list layout, remembered between launches. */
export function useListLayout() {
  const [layout, setLayoutState] = useState<ListLayout>(() => {
    const saved = readPreference(PREFERENCE_KEY);
    return LIST_LAYOUTS.find((l) => l === saved) ?? "sprite-right";
  });
  const setLayout = useCallback((next: ListLayout) => {
    setLayoutState(next);
    writePreference(PREFERENCE_KEY, next);
  }, []);
  return { layout, setLayout };
}
