import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";

import { CategoryIcon } from "@/components/category-icon";
import { GamePicker } from "@/components/game-picker";
import { PokemonLinkRow } from "@/components/reference/pokemon-link-row";
import { TypeBadge } from "@/components/type-badge";
import { Card, Segmented, SectionTitle, TABULAR, Tag } from "@/components/ui";
import { useDb } from "@/db";
import { getMove } from "@/db/reference-queries";
import type { LearnMethod } from "@/db/schema";
import { damageClass } from "@/lib/damage-class";
import { GAME_INFO } from "@/lib/games";
import {
  LEARN_METHOD_LABELS,
  priorityLabel,
  targetLabel,
} from "@/lib/reference-labels";
import { useCurrentGame } from "@/state/current-game";

/** A move: what it does, and every Pokémon that learns it in the current game. */
export default function MoveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { game } = useCurrentGame();
  const detail = useMemo(() => getMove(db, Number(id), game), [db, id, game]);
  const [method, setMethod] = useState<LearnMethod>("level");

  if (!detail) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Move" }} />
        <Text className="text-body text-ink-muted">No such move.</Text>
      </View>
    );
  }
  // A method with no learners in this game falls back to the first one.
  const section =
    detail.sections.find((s) => s.method === method) ??
    detail.sections[0] ??
    null;
  const cls = damageClass(detail);
  const tags = [
    detail.machine,
    detail.makesContact ? "Contact" : null,
    priorityLabel(detail.priority),
    targetLabel(detail.target),
    detail.effectChance > 0 ? `${detail.effectChance}% effect chance` : null,
  ].filter((t): t is string => t !== null);

  return (
    <FlatList
      data={section?.learners ?? []}
      keyExtractor={(l) => String(l.pokemonId)}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
      ListHeaderComponent={
        <View className="gap-4 pb-3 pt-2">
          <Stack.Screen options={{ title: detail.name }} />
          <Card className="gap-4 p-4">
            <View className="flex-row items-center gap-2">
              <TypeBadge type={detail.type} />
              <View className="flex-row items-center gap-1.5 rounded-full bg-sunken py-1 pl-1.5 pr-3">
                <CategoryIcon cls={cls} size={16} />
                <Text className="text-callout font-semibold text-ink">
                  {cls[0]!.toUpperCase() + cls.slice(1)}
                </Text>
              </View>
            </View>
            <View className="flex-row">
              <Fact
                label="Power"
                value={
                  detail.power === 0
                    ? "—"
                    : detail.power === 1
                      ? "Varies"
                      : String(detail.power)
                }
              />
              <Fact
                label="Accuracy"
                value={detail.accuracy === 0 ? "—" : `${detail.accuracy}%`}
              />
              <Fact label="PP" value={String(detail.pp)} />
            </View>
            <Text className="text-body text-ink">{detail.description}</Text>
            {tags.length > 0 && (
              <View className="flex-row flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </View>
            )}
          </Card>

          <SectionTitle>Learned by</SectionTitle>
          <GamePicker />
          {section ? (
            <Segmented
              options={detail.sections.map((s) => ({
                value: s.method,
                label: LEARN_METHOD_LABELS[s.method],
                count: s.learners.length,
              }))}
              value={section.method}
              onChange={setMethod}
            />
          ) : (
            <Text className="px-1 text-body text-ink-muted">
              No Pokémon learns it in {GAME_INFO[game].name}.
            </Text>
          )}
        </View>
      }
      renderItem={({ item: l, index }) => (
        <PokemonLinkRow
          {...l}
          sub={l.from ? `From ${l.from}` : null}
          first={index === 0}
          last={index === (section?.learners.length ?? 0) - 1}
          right={
            section?.method === "level" ? (
              <Text
                className="text-callout font-semibold text-ink-muted"
                style={TABULAR}
              >
                {l.level === 0 ? "Evolve" : `Lv ${l.level}`}
              </Text>
            ) : null
          }
        />
      )}
    />
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-0.5">
      <Text className="text-title font-bold text-ink" style={TABULAR}>
        {value}
      </Text>
      <Text className="text-caption text-ink-muted">{label}</Text>
    </View>
  );
}
