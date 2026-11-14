import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";

import { PokeballMark } from "@/components/pokeball-mark";
import { dexNumber, useTypeGradient } from "@/components/pokemon-row";
import { Sprite } from "@/components/sprite";
import { TypeBadge } from "@/components/type-badge";
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
    <View className="px-4 pb-12 pt-5">
      <Stage node={chain} currentId={currentId} />
      {chain.evolutions.length === 0 && (
        <Text className="mt-4 text-center text-body text-ink-muted">
          {chain.name} doesn’t evolve.
        </Text>
      )}
    </View>
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
          {/* The connector: how this step happens. */}
          <View className="flex-row items-center gap-2.5 py-2 pl-10">
            <View className="h-6 w-0.5 rounded-full bg-line" />
            <View className="rounded-lg bg-accent/15 px-2.5 py-1">
              <Text className="text-caption font-semibold text-accent">
                {evolutionLabel(evo.method, evo.level, evo.item)}
              </Text>
            </View>
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
  const gradient = useTypeGradient(node);
  const card = (
    <View
      className={`overflow-hidden rounded-card ${
        current ? "border-2 border-accent" : "border-2 border-transparent"
      }`}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={{ position: "absolute", inset: 0 }}
      />
      <PokeballMark
        size={96}
        style={{ position: "absolute", left: -14, top: -12 }}
      />
      <View className="flex-row items-center gap-3 p-2 pr-3">
        <Sprite id={node.id} size={72} />
        <View className="flex-1 gap-1.5">
          <View className="flex-row items-baseline gap-2">
            <Text className="text-headline font-bold text-ink">
              {node.name}
            </Text>
            <Text className="text-caption font-semibold text-ink-subtle">
              {dexNumber(node.id)}
            </Text>
            {current && (
              <Text className="ml-auto text-caption font-semibold text-accent">
                Viewing
              </Text>
            )}
          </View>
          <View className="flex-row gap-1.5">
            <TypeBadge type={node.type1} small />
            {node.type2 && <TypeBadge type={node.type2} small />}
          </View>
        </View>
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
