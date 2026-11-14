import { Text, View } from "react-native";

import type { LocationEntry, StaticEncounterEntry } from "@/db/queries";
import { Card, Divider, SectionTitle, TABULAR, Tag } from "@/components/ui";
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
    <View className="gap-2 px-4 pb-12 pt-5">
      {places.length === 0 && oneTime.length === 0 ? (
        <Card className="gap-1 p-4">
          <Text className="text-body font-semibold text-ink">
            Can’t be caught or received in {gameName}.
          </Text>
          <Text className="text-callout text-ink-muted">
            {foundIn.length > 0
              ? `It can be found in ${gamesLabel(foundIn)}. Otherwise evolve, breed or trade for it.`
              : "Get it by evolving, breeding or trading."}
          </Text>
        </Card>
      ) : null}

      {oneTime.length > 0 ? (
        <>
          <SectionTitle>{`Gifts and one-time in ${gameName}`}</SectionTitle>
          {oneTime.map((e) => (
            <Card key={e.id} className="gap-1 p-4">
              <View className="flex-row items-center gap-3">
                <Text className="flex-1 text-body font-semibold text-ink">
                  {e.place ?? "Roams the region"}
                </Text>
                <Tag>{KIND_LABELS[e.kind]}</Tag>
              </View>
              <Text className="text-callout text-ink">{details(e)}</Text>
              {e.note ? (
                <Text className="text-callout text-ink-muted">{e.note}</Text>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {places.length > 0 ? (
        <>
          <View className={oneTime.length > 0 ? "mt-4" : ""}>
            <SectionTitle>{`In the wild in ${gameName}`}</SectionTitle>
          </View>
          {places.map((place) => (
            <Card key={place.locationId}>
              <Text className="px-4 pb-2 pt-3.5 text-body font-semibold text-ink">
                {place.name}
              </Text>
              {place.encounters.map((e) => (
                <View key={e.method}>
                  <Divider className="ml-4" />
                  <View className="flex-row items-center gap-3 px-4 py-2.5">
                    <Text className="flex-1 text-callout text-ink-muted">
                      {METHOD_LABELS[e.method]}
                    </Text>
                    <Text
                      className="text-callout text-ink-muted"
                      style={TABULAR}
                    >
                      {e.minLevel === e.maxLevel
                        ? `Lv ${e.minLevel}`
                        : `Lv ${e.minLevel}–${e.maxLevel}`}
                    </Text>
                    <Text
                      className="w-12 text-right text-callout font-semibold text-ink"
                      style={TABULAR}
                    >
                      {e.rate}%
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          ))}
        </>
      ) : oneTime.length > 0 ? (
        <Text className="px-1 text-callout text-ink-muted">
          Not found in the wild in {gameName}.
        </Text>
      ) : null}
    </View>
  );
}
