import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View } from "react-native";

import type { LocationEntry, StaticEncounterEntry } from "@/db/queries";
import { Card, Divider, SectionTitle, TABULAR, Tag } from "@/components/ui";
import type { Game } from "@/db/schema";
import { GAME_INFO, gamesLabel } from "@/lib/games";
import {
  KIND_LABELS,
  METHOD_LABELS,
  METHOD_NOTES,
  staticDetails,
} from "@/lib/places";
import { useColors } from "@/theme/theme";

/** Where to get the Pokémon in the current game: gifts and one-time encounters, then the wild. */
export function LocationsPage({
  pokemonId,
  places,
  oneTime,
  game,
  foundIn,
}: {
  pokemonId: number;
  places: LocationEntry[];
  oneTime: StaticEncounterEntry[];
  game: Game;
  /** Games where it can be caught or received at all. */
  foundIn: Game[];
}) {
  const gameName = GAME_INFO[game].name;
  return (
    <View className="gap-2 px-4 pb-12 pt-5">
      {(places.length > 0 || oneTime.length > 0) && (
        <MapLink pokemonId={pokemonId} />
      )}
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
              <Text className="text-callout text-ink">{staticDetails(e)}</Text>
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
              <PlaceLink id={place.locationId} name={place.name} />
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
                  {METHOD_NOTES[e.method] && (
                    <Text className="-mt-1 px-4 pb-2.5 text-caption text-ink-subtle">
                      {METHOD_NOTES[e.method]}
                    </Text>
                  )}
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

/** A place's name, opening its page (every Pokémon found there). */
function PlaceLink({ id, name }: { id: number; name: string }) {
  const colors = useColors();
  return (
    <Link href={{ pathname: "/places/[id]", params: { id } }} asChild>
      <Pressable className="flex-row items-center gap-1 px-4 pb-2 pt-3.5 active:opacity-60">
        <Text className="flex-1 text-body font-semibold text-ink">{name}</Text>
        <SymbolView
          name={{
            ios: "chevron.right",
            android: "chevron_right",
            web: "chevron_right",
          }}
          tintColor={colors["ink-subtle"]}
          size={18}
        />
      </Pressable>
    </Link>
  );
}

/** Opens the Town Map with this Pokémon's areas marked. */
function MapLink({ pokemonId }: { pokemonId: number }) {
  const colors = useColors();
  return (
    <Link href={{ pathname: "/map", params: { pokemon: pokemonId } }} asChild>
      <Pressable className="mb-2 flex-row items-center gap-3 rounded-card bg-surface px-4 py-3 active:bg-sunken">
        <SymbolView
          name={{ ios: "map", android: "map", web: "map" }}
          tintColor={colors.accent}
          size={22}
        />
        <Text className="flex-1 text-body font-semibold text-ink">
          Show on the Town Map
        </Text>
        <SymbolView
          name={{
            ios: "chevron.right",
            android: "chevron_right",
            web: "chevron_right",
          }}
          tintColor={colors["ink-subtle"]}
          size={18}
        />
      </Pressable>
    </Link>
  );
}
