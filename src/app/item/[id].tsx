import { Link, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { GamePicker } from "@/components/game-picker";
import { PokemonLinkRow } from "@/components/reference/pokemon-link-row";
import { TypeDot } from "@/components/type-badge";
import { Card, SectionTitle, TABULAR, Tag } from "@/components/ui";
import { useDb } from "@/db";
import { getItem } from "@/db/reference-queries";
import { GAME_INFO } from "@/lib/games";
import { HELD_CHANCE, POCKET_LABELS, priceText } from "@/lib/reference-labels";
import { useCurrentGame } from "@/state/current-game";
import { useColors } from "@/theme/theme";

/** An item: what it does, the move it teaches, and wild Pokémon that hold it. */
export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { game } = useCurrentGame();
  const colors = useColors();
  const detail = useMemo(() => getItem(db, Number(id), game), [db, id, game]);

  if (!detail) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Item" }} />
        <Text className="text-body text-ink-muted">No such item.</Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerClassName="gap-4 px-4 pb-12 pt-2">
      <Stack.Screen options={{ title: detail.name }} />
      <Card className="gap-3 p-4">
        <View className="flex-row flex-wrap gap-1.5">
          {detail.pocket && <Tag>{POCKET_LABELS[detail.pocket]}</Tag>}
          {detail.holdEffect && <Tag>Works when held</Tag>}
        </View>
        <Text className="text-body text-ink">{detail.description}</Text>
        <Text className="text-callout text-ink-muted" style={TABULAR}>
          {priceText(detail.price)}
        </Text>
      </Card>

      {detail.teaches && (
        <View className="gap-2">
          <SectionTitle>Teaches</SectionTitle>
          <Link
            href={{ pathname: "/move/[id]", params: { id: detail.teaches.id } }}
            asChild
          >
            <Pressable className="flex-row items-center gap-3 rounded-card bg-surface px-4 py-3.5 active:bg-sunken">
              <TypeDot type={detail.teaches.type} size={22} />
              <Text className="flex-1 text-body font-semibold text-ink">
                {detail.teaches.name}
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
        </View>
      )}

      {detail.pocket !== "key-items" && detail.pocket !== "tms-hms" && (
        <View className="gap-2">
          <SectionTitle>Held by wild Pokémon</SectionTitle>
          <GamePicker />
          {detail.heldBy.length === 0 ? (
            <Text className="px-1 text-body text-ink-muted">
              No wild Pokémon holds it in {GAME_INFO[game].name}.
            </Text>
          ) : (
            <View>
              {detail.heldBy.map((p, i) => (
                <PokemonLinkRow
                  key={`${p.pokemonId}-${p.rarity}`}
                  {...p}
                  first={i === 0}
                  last={i === detail.heldBy.length - 1}
                  right={
                    <Text
                      className="text-callout font-semibold text-ink"
                      style={TABULAR}
                    >
                      {HELD_CHANCE[p.rarity]}%
                    </Text>
                  }
                />
              ))}
              <Text className="px-1 pt-2 text-caption text-ink-subtle">
                Chance that a wild one is holding it when you meet it.
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
