import { Image, Platform, View, type ImageStyle } from "react-native";

import type { Game } from "@/db/schema";
import { trainerPics } from "@/generated/trainer-pics";

// Browsers smooth scaled images; pixel art should stay blocky.
const PIXELATED =
  Platform.OS === "web"
    ? ({ imageRendering: "pixelated" } as unknown as ImageStyle)
    : null;

/**
 * A trainer's battle picture from the game (64×64, stored at 4× like the
 * Pokémon sprites; see scripts/trainers). Leaves an empty square for a
 * trainer without one, so layouts don't jump.
 */
export function TrainerPic({
  game,
  trainerKey,
  size,
}: {
  game: Game;
  /** pret constant, e.g. TRAINER_ROXANNE_1. */
  trainerKey: string;
  size: number;
}) {
  const source = trainerPics[`${game}:${trainerKey}`];
  if (!source) return <View style={{ width: size, height: size }} />;
  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, PIXELATED]}
      accessibilityIgnoresInvertColors
    />
  );
}
