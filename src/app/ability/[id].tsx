import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { FlatList, Text, View } from "react-native";

import { PokemonLinkRow } from "@/components/reference/pokemon-link-row";
import { Card, SectionTitle } from "@/components/ui";
import { useDb } from "@/db";
import { getAbility } from "@/db/reference-queries";

/** An ability and every Pokémon that can have it. */
export default function AbilityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const detail = useMemo(() => getAbility(db, Number(id)), [db, id]);

  if (!detail) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Ability" }} />
        <Text className="text-body text-ink-muted">No such ability.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={detail.pokemon}
      keyExtractor={(p) => String(p.pokemonId)}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
      ListHeaderComponent={
        <View className="gap-4 pb-3 pt-2">
          <Stack.Screen options={{ title: detail.name }} />
          <Card className="p-4">
            <Text className="text-body text-ink">{detail.description}</Text>
          </Card>
          <SectionTitle>{`Pokémon with ${detail.name} · ${detail.pokemon.length}`}</SectionTitle>
          <Text className="-mt-2 px-1 text-callout text-ink-muted">
            In Gen 3 a species has one or two abilities; each Pokémon gets one
            of them when it’s met.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text className="px-1 text-body text-ink-muted">
          No Pokémon has this ability.
        </Text>
      }
      renderItem={({ item: p, index }) => (
        <PokemonLinkRow
          {...p}
          first={index === 0}
          last={index === detail.pokemon.length - 1}
          sub={p.other ? `Or ${p.other}` : "Its only ability"}
        />
      )}
    />
  );
}
