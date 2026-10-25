import { Link, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

import { GamePicker } from "@/components/game-picker";
import { POKEMON_ROW_HEIGHT, PokemonRow } from "@/components/pokemon-row";
import { useDb } from "@/db";
import { listPokemon } from "@/db/queries";

export default function PokedexScreen() {
  const db = useDb();
  const all = useMemo(() => listPokemon(db), [db]);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const shown = q
    ? all.filter((p) => p.name.toLowerCase().includes(q) || String(p.id) === q)
    : all;

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: "Pokédex" }} />
      <GamePicker />
      <TextInput
        className="mx-4 my-2 rounded-lg bg-neutral-100 px-3 py-2 text-base text-neutral-900"
        placeholder="Search by name or number"
        placeholderTextColor="#737373"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      <FlatList
        data={shown}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => (
          // asChild: Link passes its press handling to the Pressable.
          <Link
            href={{ pathname: "/pokemon/[id]", params: { id: item.id } }}
            asChild
          >
            <Pressable android_ripple={{ color: "#e5e5e5" }}>
              <PokemonRow pokemon={item} />
            </Pressable>
          </Link>
        )}
        getItemLayout={(_, index) => ({
          length: POKEMON_ROW_HEIGHT,
          offset: POKEMON_ROW_HEIGHT * index,
          index,
        })}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text className="p-8 text-center text-neutral-500">
            No Pokémon match “{query}”.
          </Text>
        }
      />
    </View>
  );
}
