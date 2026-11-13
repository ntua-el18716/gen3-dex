import { Image, Platform, type ImageStyle } from "react-native";

import type { Game } from "@/db/schema";
import {
  frlgFrontShinySprites,
  frlgFrontSprites,
  frontShinySprites,
  frontSprites,
} from "@/generated/sprites";
import { useCurrentGame } from "@/state/current-game";

// Browsers smooth scaled images; pixel art should stay blocky. (Not a React
// Native style property, so it's only added on web, where it's passed to CSS.)
const PIXELATED =
  Platform.OS === "web"
    ? ({ imageRendering: "pixelated" } as unknown as ImageStyle)
    : null;

/**
 * A Pokémon's front sprite, as drawn in the current game: FireRed and
 * LeafGreen redrew most Kanto Pokémon, everything else uses Emerald's. The
 * files are the games' 64×64 sprites stored at 4× (see scripts/sprites), so
 * any size up to 256 is a downscale and stays crisp on Android, which
 * smooths images it scales up.
 */
export function Sprite({
  id,
  size = 64,
  shiny = false,
  game,
}: {
  id: number;
  size?: number;
  shiny?: boolean;
  /** Draw as in this game instead of the current one (e.g. the Frontier). */
  game?: Game;
}) {
  const current = useCurrentGame().game;
  const frlg =
    (game ?? current) === "firered" || (game ?? current) === "leafgreen";
  const source =
    (frlg
      ? (shiny ? frlgFrontShinySprites : frlgFrontSprites)[id]
      : undefined) ?? (shiny ? frontShinySprites : frontSprites)[id];
  return (
    <Image source={source} style={[{ width: size, height: size }, PIXELATED]} />
  );
}
