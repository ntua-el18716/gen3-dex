import type { Game, VersionGroup } from "@/db/schema";

/** Mirrors the `game` table (a test checks they agree), so the UI needs no query. */
export const GAME_INFO: Record<
  Game,
  { name: string; short: string; versionGroup: VersionGroup }
> = {
  ruby: { name: "Ruby", short: "R", versionGroup: "rs" },
  sapphire: { name: "Sapphire", short: "S", versionGroup: "rs" },
  emerald: { name: "Emerald", short: "E", versionGroup: "e" },
  firered: { name: "FireRed", short: "FR", versionGroup: "frlg" },
  leafgreen: { name: "LeafGreen", short: "LG", versionGroup: "frlg" },
};

/** Short label for several games, e.g. "R/S/E" or "FR". */
export function gamesLabel(games: readonly Game[]): string {
  return games.map((g) => GAME_INFO[g].short).join("/");
}
