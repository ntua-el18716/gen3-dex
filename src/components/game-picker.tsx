import { Pressable, Text, View } from "react-native";

import { GAMES } from "@/db/schema";
import { GAME_INFO } from "@/lib/games";
import { useCurrentGame } from "@/state/current-game";

/** A row of chips (R, S, E, FR, LG) that sets the current game. */
export function GamePicker() {
  const { game, setGame } = useCurrentGame();
  return (
    <View className="flex-row gap-2 px-4 py-2">
      {GAMES.map((g) => {
        const selected = g === game;
        return (
          <Pressable
            key={g}
            onPress={() => setGame(g)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={GAME_INFO[g].name}
            className={`flex-1 items-center rounded-full border py-1 ${
              selected
                ? "border-neutral-900 bg-neutral-900"
                : "border-neutral-300 bg-white"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                selected ? "text-white" : "text-neutral-700"
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
