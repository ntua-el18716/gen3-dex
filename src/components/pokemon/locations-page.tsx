import { ScrollView, Text, View } from "react-native";

import type { LocationEntry, StaticEncounterEntry } from "@/db/queries";
import type { EncounterMethod, Game, StaticEncounterKind } from "@/db/schema";
import { GAME_INFO, gamesLabel } from "@/lib/games";

const METHOD_LABELS: Record<EncounterMethod, string> = {
  grass: "Walking",
  surf: "Surfing",
  "rock-smash": "Rock Smash",
  "old-rod": "Old Rod",
  "good-rod": "Good Rod",
  "super-rod": "Super Rod",
};

const KIND_LABELS: Record<StaticEncounterKind, string> = {
  starter: "Starter",
  gift: "Gift",
  egg: "Egg",
  static: "One-time",
  roaming: "Roaming",
  trade: "Trade",
  prize: "Prize",
};

/** "Lv 25 · Holds Mystic Water", "Trade for Ralts · Nicknamed Dots"… */
function details(e: StaticEncounterEntry): string {
  const parts: string[] = [];
  if (e.kind === "trade") {
    parts.push(`Trade for ${e.tradeFor}`);
    if (e.nickname) parts.push(`Nicknamed ${e.nickname}`);
  } else if (e.kind === "egg") {
    parts.push(`Hatches at Lv ${e.level}`);
  } else {
    parts.push(`Lv ${e.level}`);
  }
  if (e.count > 1) parts.push(`${e.count} of them`);
  if (e.heldItem) parts.push(`Holds ${e.heldItem}`);
  return parts.join(" · ");
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
      {children}
    </Text>
  );
}

/** Where to get the Pokémon in the current game: gifts and one-time encounters, then the wild. */
export function LocationsPage({
  places,
  oneTime,
  game,
  foundIn,
}: {
  places: LocationEntry[];
  oneTime: StaticEncounterEntry[];
  game: Game;
  /** Games where it can be caught or received at all. */
  foundIn: Game[];
}) {
  const gameName = GAME_INFO[game].name;
  return (
    <ScrollView contentContainerClassName="gap-3 p-4 pb-12">
      {places.length === 0 && oneTime.length === 0 ? (
        <View className="gap-2 rounded-2xl border border-line bg-surface p-4">
          <Text className="font-bold text-ink">
            Can’t be caught or received in {gameName}.
          </Text>
          <Text className="text-sm text-ink-muted">
            {foundIn.length > 0
              ? `It can be found in ${gamesLabel(foundIn)}. Otherwise evolve, breed or trade for it.`
              : "Get it by evolving, breeding or trading."}
          </Text>
        </View>
      ) : null}

      {oneTime.length > 0 ? (
        <>
          <SectionTitle>{`Gifts & one-time in ${gameName}`}</SectionTitle>
          {oneTime.map((e) => (
            <View
              key={e.id}
              className="gap-1 rounded-2xl border border-line bg-surface p-4"
            >
              <View className="flex-row items-center gap-3">
                <Text className="flex-1 text-base font-bold text-ink">
                  {e.place ?? "Roams the region"}
                </Text>
                <View className="rounded-full bg-sunken px-2.5 py-0.5">
                  <Text className="text-xs font-bold text-ink">
                    {KIND_LABELS[e.kind]}
                  </Text>
                </View>
              </View>
              <Text className="text-sm font-semibold text-ink">
                {details(e)}
              </Text>
              {e.note ? (
                <Text className="text-sm text-ink-muted">{e.note}</Text>
              ) : null}
            </View>
          ))}
        </>
      ) : null}

      {places.length > 0 ? (
        <>
          <SectionTitle>{`Wild in ${gameName}`}</SectionTitle>
          {places.map((place) => (
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
                    <Text className="text-xs font-bold text-ink">
                      {e.rate}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </>
      ) : oneTime.length > 0 ? (
        <Text className="text-sm text-ink-muted">
          Not found in the wild in {gameName}.
        </Text>
      ) : null}
    </ScrollView>
  );
}
