import { GAMES } from "@/db/schema";
import { GAME_INFO } from "@/lib/games";
import { useCurrentGame } from "@/state/current-game";
import { useColors } from "@/theme/theme";

import { Segmented } from "./ui";

const OPTIONS = GAMES.map((g) => ({
  value: g,
  label: GAME_INFO[g].short,
  a11yLabel: GAME_INFO[g].name,
}));

/**
 * A segmented control (R, S, E, FR, LG) that sets the current game. The
 * selected game is filled with the accent, which is that game's colour.
 */
export function GamePicker() {
  const { game, setGame } = useCurrentGame();
  const colors = useColors();
  return (
    <Segmented
      options={OPTIONS}
      value={game}
      onChange={setGame}
      tone="accent"
      selectedColor={colors.accent}
      fill
    />
  );
}
