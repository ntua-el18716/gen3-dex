import { createContext, use, useMemo, useState, type ReactNode } from "react";

import type { Game } from "@/db/schema";

type CurrentGame = { game: Game; setGame: (game: Game) => void };

const CurrentGameContext = createContext<CurrentGame | null>(null);

/** The game the user is looking at; per-game data (Dex text, moves…) follows it. */
export function CurrentGameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<Game>("emerald");
  const value = useMemo(() => ({ game, setGame }), [game]);
  return <CurrentGameContext value={value}>{children}</CurrentGameContext>;
}

export function useCurrentGame(): CurrentGame {
  const value = use(CurrentGameContext);
  if (!value) {
    throw new Error("useCurrentGame must be used inside <CurrentGameProvider>");
  }
  return value;
}
