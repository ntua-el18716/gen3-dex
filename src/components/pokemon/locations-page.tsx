import { ScrollView, Text, View } from "react-native";

import type { LocationEntry } from "@/db/queries";
import type { EncounterMethod, Game } from "@/db/schema";
import { GAME_INFO, gamesLabel } from "@/lib/games";

const METHOD_LABELS: Record<EncounterMethod, string> = {
  grass: "Walking",
  surf: "Surfing",
  "rock-smash": "Rock Smash",
  "old-rod": "Old Rod",
  "good-rod": "Good Rod",
  "super-rod": "Super Rod",
};

/** Where the Pokémon lives in the wild in the current game. */
export function LocationsPage({
  places,
  game,
  wildIn,
}: {
  places: LocationEntry[];
  game: Game;
  /** Games where it can be found in the wild at all. */
  wildIn: Game[];
}) {
  const gameName = GAME_INFO[game].name;
  return (
    <ScrollView contentContainerClassName="gap-3 p-4 pb-12">
      <Text className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
        Wild in {gameName}
      </Text>
      {places.length === 0 ? (
        <View className="gap-2 rounded-2xl border border-line bg-surface p-4">
          <Text className="font-bold text-ink">
            Not found in the wild in {gameName}.
          </Text>
          <Text className="text-sm text-ink-muted">
            {wildIn.length > 0
              ? `It is wild in ${gamesLabel(wildIn)}. Otherwise evolve it or trade for it.`
              : "Get it by evolving, trading, as a gift or a one-time encounter."}{" "}
            Gifts and one-time encounters aren’t listed yet.
          </Text>
        </View>
      ) : (
        places.map((place) => (
          <View
            key={place.locationId}
            className="gap-2 rounded-2xl border border-line bg-surface p-4"
          >
            <Text className="text-base font-bold text-ink">{place.name}</Text>
            {place.encounters.map((e) => (
              <View key={e.method} className="flex-row items-center gap-3">
                <Text className="flex-1 text-sm text-ink-muted">
                  {METHOD_LABELS[e.method]}
                </Text>
                <Text className="text-sm font-semibold text-ink">
                  {e.minLevel === e.maxLevel
                    ? `Lv ${e.minLevel}`
                    : `Lv ${e.minLevel}–${e.maxLevel}`}
                </Text>
                <View className="w-14 items-center rounded-full bg-sunken py-0.5">
                  <Text className="text-xs font-bold text-ink">{e.rate}%</Text>
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}
