import { Pressable, Text, View } from "react-native";

import { GAMES, type Game } from "@/db/schema";
import { GAME_INFO } from "@/lib/games";
import { useCurrentGame } from "@/state/current-game";

// Full class names so Tailwind generates them (see type-badge.tsx).
const SELECTED: Record<Game, string> = {
  ruby: "bg-game-ruby",
  sapphire: "bg-game-sapphire",
  emerald: "bg-game-emerald",
  firered: "bg-game-firered",
  leafgreen: "bg-game-leafgreen",
};

/** A segmented control (R, S, E, FR, LG) that sets the current game. */
export function GamePicker() {
  const { game, setGame } = useCurrentGame();
  return (
    <View className="flex-row gap-1 rounded-full bg-sunken p-1">
      {GAMES.map((g) => {
        const selected = g === game;
        return (
          <Pressable
            key={g}
            onPress={() => setGame(g)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={GAME_INFO[g].name}
            className={`flex-1 items-center rounded-full py-1.5 ${
              selected ? SELECTED[g] : ""
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                selected ? "text-white" : "text-ink-muted"
              }`}
            >
              {GAME_INFO[g].short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
