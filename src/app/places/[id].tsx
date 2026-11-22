import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { GamePicker } from "@/components/game-picker";
import { Sprite } from "@/components/sprite";
import { TypeDot } from "@/components/type-badge";
import { Card, Divider, SectionTitle, TABULAR, Tag } from "@/components/ui";
import { useDb } from "@/db";
import { getPlace } from "@/db/queries";
import type { PokemonType } from "@/db/schema";
import { GAME_INFO } from "@/lib/games";
import { REGION } from "@/lib/league";
import { KIND_LABELS, METHOD_LABELS, staticDetails } from "@/lib/places";
import { useCurrentGame } from "@/state/current-game";

/** One place in the current game: its wild Pokémon and one-time encounters. */
export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { game } = useCurrentGame();
  const place = useMemo(() => getPlace(db, Number(id), game), [db, id, game]);

  if (!place) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Place" }} />
        <Text className="text-body text-ink-muted">No such place.</Text>
      </View>
    );
  }
  const elsewhere = REGION[game] !== place.region;
  const empty = place.methods.length === 0 && place.oneTime.length === 0;

  return (
    <ScrollView contentContainerClassName="gap-6 px-4 pb-12 pt-2">
      <Stack.Screen options={{ title: place.name }} />
      <GamePicker />

      {(elsewhere || empty) && (
        <Text className="px-1 text-body text-ink-muted">
          {elsewhere
            ? `${place.name} is in ${place.region === "hoenn" ? "Hoenn (Ruby, Sapphire, Emerald)" : "Kanto (FireRed, LeafGreen)"}.`
            : `No Pokémon here in ${GAME_INFO[game].name}.`}
        </Text>
      )}

      {place.oneTime.length > 0 && (
        <View className="gap-2">
          <SectionTitle>Gifts and one-time</SectionTitle>
          <Card>
            {place.oneTime.map((e, i) => (
              <View key={e.id}>
                {i > 0 && <Divider className="ml-[72px]" />}
                <PokemonLink id={e.pokemonId}>
                  <Sprite id={e.pokemonId} size={48} />
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Name name={e.name} type1={e.type1} type2={e.type2} />
                      <Tag>{KIND_LABELS[e.kind]}</Tag>
                    </View>
                    <Text className="text-callout text-ink-muted">
                      {staticDetails(e)}
                    </Text>
                    {e.note && (
                      <Text className="text-caption text-ink-subtle">
                        {e.note}
                      </Text>
                    )}
                  </View>
                </PokemonLink>
              </View>
            ))}
          </Card>
        </View>
      )}

      {place.methods.map((m) => (
        <View key={m.method} className="gap-2">
          <SectionTitle>{METHOD_LABELS[m.method]}</SectionTitle>
          <Card>
            {m.mons.map((mon, i) => (
              <View key={mon.pokemonId}>
                {i > 0 && <Divider className="ml-[72px]" />}
                <PokemonLink id={mon.pokemonId}>
                  <Sprite id={mon.pokemonId} size={48} />
                  <View className="flex-1 gap-1">
                    <Name name={mon.name} type1={mon.type1} type2={mon.type2} />
                    <View className="h-1.5 overflow-hidden rounded-full bg-sunken">
                      <View
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${mon.rate}%` }}
                      />
                    </View>
                  </View>
                  <View className="w-[72px] items-end">
                    <Text
                      className="text-body font-bold text-ink"
                      style={TABULAR}
                    >
                      {mon.rate}%
                    </Text>
                    <Text
                      className="text-caption text-ink-muted"
                      style={TABULAR}
                    >
                      {mon.minLevel === mon.maxLevel
                        ? `Lv ${mon.minLevel}`
                        : `Lv ${mon.minLevel}–${mon.maxLevel}`}
                    </Text>
                  </View>
                </PokemonLink>
              </View>
            ))}
          </Card>
        </View>
      ))}
      {place.methods.length > 0 && (
        <Text className="px-1 text-caption text-ink-subtle">
          Chance of each Pokémon when you meet one that way.
        </Text>
      )}
    </ScrollView>
  );
}

function Name({
  name,
  type1,
  type2,
}: {
  name: string;
  type1: PokemonType;
  type2: PokemonType | null;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-body font-semibold text-ink" numberOfLines={1}>
        {name}
      </Text>
      <TypeDot type={type1} size={18} />
      {type2 && <TypeDot type={type2} size={18} />}
    </View>
  );
}

function PokemonLink({
  id,
  children,
}: {
  id: number;
  children: React.ReactNode;
}) {
  return (
    <Link href={{ pathname: "/pokemon/[id]", params: { id } }} asChild>
      <Pressable className="flex-row items-center gap-3 px-3 py-2 active:bg-sunken">
        {children}
      </Pressable>
    </Link>
  );
}
