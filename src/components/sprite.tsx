import { Image, Platform, type ImageStyle } from "react-native";

import { frontShinySprites, frontSprites } from "@/generated/sprites";

// Browsers smooth scaled images; pixel art should stay blocky. (Not a React
// Native style property, so it's only added on web, where it's passed to CSS.)
const PIXELATED =
  Platform.OS === "web"
    ? ({ imageRendering: "pixelated" } as unknown as ImageStyle)
    : null;

/** A Pokémon's 64×64 front sprite, best shown at 64 or a multiple of it. */
export function Sprite({
  id,
  size = 64,
  shiny = false,
}: {
  id: number;
  size?: number;
  shiny?: boolean;
}) {
  return (
    <Image
      source={(shiny ? frontShinySprites : frontSprites)[id]}
      style={[{ width: size, height: size }, PIXELATED]}
    />
  );
}
