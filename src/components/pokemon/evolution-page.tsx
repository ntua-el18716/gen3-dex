import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { dexNumber } from "@/components/pokemon-row";
import { Sprite } from "@/components/sprite";
import { TYPE_TINT, TypeBadge } from "@/components/type-badge";
import type { EvolutionNode } from "@/db/queries";
import { evolutionLabel } from "@/lib/evolution";

/** The Pokémon's whole evolution family, with how each step happens. */
export function EvolutionPage({
  chain,
  currentId,
}: {
  chain: EvolutionNode;
  currentId: number;
}) {
  return (
    <ScrollView contentContainerClassName="p-4 pb-12">
      <Stage node={chain} currentId={currentId} />
      {chain.evolutions.length === 0 && (
        <Text className="mt-4 text-center text-ink-muted">
          {chain.name} doesn’t evolve.
        </Text>
      )}
    </ScrollView>
  );
}

/** A stage and everything it evolves into. Branches are indented. */
function Stage({
  node,
  currentId,
}: {
  node: EvolutionNode;
  currentId: number;
}) {
  const branches = node.evolutions.length > 1;
  return (
    <View>
      <StageCard node={node} current={node.id === currentId} />
      {node.evolutions.map((evo) => (
        <View
          key={evo.into.id}
          className={branches ? "ml-6 border-l-2 border-line pl-4" : ""}
        >
          <View className="flex-row items-center gap-2 py-2 pl-6">
            <Text className="text-lg text-ink-subtle">↓</Text>
            <Text className="flex-1 text-sm font-semibold text-ink-muted">
              {evolutionLabel(evo.method, evo.level, evo.item)}
            </Text>
          </View>
          <Stage node={evo.into} currentId={currentId} />
        </View>
      ))}
    </View>
  );
}

function StageCard({
  node,
  current,
}: {
  node: EvolutionNode;
  current: boolean;
}) {
  const card = (
    <View
      className={`flex-row items-center gap-3 rounded-2xl border bg-surface p-2 ${
        current ? "border-accent" : "border-line"
      }`}
    >
      <View
        className={`h-16 w-16 items-center justify-center rounded-xl ${TYPE_TINT[node.type1]}`}
      >
        <Sprite id={node.id} />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-semibold text-ink-subtle">
          {dexNumber(node.id)}
        </Text>
        <Text className="text-base font-bold text-ink">{node.name}</Text>
      </View>
      <View className="gap-1 pr-2">
        <TypeBadge type={node.type1} small />
        {node.type2 && <TypeBadge type={node.type2} small />}
      </View>
    </View>
  );
  // The Pokémon already on screen isn't a link.
  if (current) return card;
  return (
    <Link href={{ pathname: "/pokemon/[id]", params: { id: node.id } }} asChild>
      <Pressable className="active:opacity-70">{card}</Pressable>
    </Link>
  );
}
