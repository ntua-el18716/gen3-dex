import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { View } from "react-native";

import type { Game } from "@/db/schema";
import { facilityInfo } from "@/lib/frontier-facilities";
import { isFrontier, type TeamPurpose } from "@/lib/teams";
import { GAME_ACCENTS } from "@/theme/colors";

/**
 * What a team is for, as a coloured tile: the facility's symbol in its
 * colour, or a map in the game's colour for a walkthrough.
 */
export function PurposeIcon({
  purpose,
  game,
  size = 40,
}: {
  purpose: TeamPurpose;
  game: Game;
  size?: number;
}) {
  const facility = isFrontier(purpose) ? facilityInfo(purpose) : undefined;
  const [r, g, b] = GAME_ACCENTS.light[game];
  const name = (
    facility
      ? {
          ios: facility.icon.ios,
          android: facility.icon.android,
          web: facility.icon.android,
        }
      : { ios: "map.fill", android: "map", web: "map" }
  ) as SymbolViewProps["name"];
  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: facility?.color ?? `rgb(${r}, ${g}, ${b})`,
      }}
    >
      <SymbolView name={name} tintColor="#FFFFFF" size={size * 0.55} />
    </View>
  );
}
