import { useState, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { TypeBadge } from "@/components/type-badge";
import type { PokedexEntry, PokemonDetail } from "@/db/queries";
import type { Game, Stat } from "@/db/schema";
import { frontShinySprites, frontSprites } from "@/generated/sprites";
import { gamesLabel } from "@/lib/games";
import {
  formatHeight,
  formatWeight,
  genderLabel,
  titleCase,
} from "@/lib/pokemon-format";
import { statRange } from "@/lib/stats";

/** The order Pokédex apps show stats in (the games store Speed fourth). */
const DISPLAY_STATS: { stat: Stat; label: string }[] = [
  { stat: "hp", label: "HP" },
  { stat: "attack", label: "Atk" },
  { stat: "defense", label: "Def" },
  { stat: "spAttack", label: "Sp. Atk" },
  { stat: "spDefense", label: "Sp. Def" },
  { stat: "speed", label: "Speed" },
];

const EV_FIELDS: Record<Stat, keyof PokemonDetail> = {
  hp: "evHp",
  attack: "evAttack",
  defense: "evDefense",
  spAttack: "evSpAttack",
  spDefense: "evSpDefense",
  speed: "evSpeed",
};

/** One egg cycle is 256 steps in Gen 3. */
const STEPS_PER_EGG_CYCLE = 256;

export function OverviewPage({
  pokemon,
  entries,
  game,
}: {
  pokemon: PokemonDetail;
  entries: PokedexEntry[];
  game: Game;
}) {
  const evYield = DISPLAY_STATS.filter(
    ({ stat }) => (pokemon[EV_FIELDS[stat]] as number) > 0,
  )
    .map(({ stat, label }) => `${pokemon[EV_FIELDS[stat]]} ${label}`)
    .join(", ");

  return (
    <ScrollView contentContainerClassName="gap-6 p-4 pb-12">
      <Header pokemon={pokemon} />

      <Section title="Pokédex">
        {entries.map((entry) => (
          <View key={entry.games.join()} className="gap-1">
            <Text
              className={`text-xs font-bold ${
                entry.games.includes(game)
                  ? "text-neutral-900"
                  : "text-neutral-400"
              }`}
            >
              {gamesLabel(entry.games)}
            </Text>
            <Text className="text-sm leading-5 text-neutral-700">
              {entry.text}
            </Text>
          </View>
        ))}
      </Section>

      <BaseStats pokemon={pokemon} />

      <Section title="Abilities">
        {pokemon.abilities.map((a) => (
          <View key={a.id}>
            <Text className="font-semibold text-neutral-900">{a.name}</Text>
            <Text className="text-sm text-neutral-600">{a.description}</Text>
          </View>
        ))}
      </Section>

      <Section title="Training">
        <InfoRow label="EV yield" value={evYield} />
        <InfoRow label="Catch rate" value={String(pokemon.catchRate)} />
        <InfoRow label="Base exp." value={String(pokemon.baseExperience)} />
        <InfoRow
          label="Base friendship"
          value={String(pokemon.baseFriendship)}
        />
        <InfoRow label="Growth rate" value={titleCase(pokemon.growthRate)} />
        <InfoRow
          label="Wild held items"
          value={
            pokemon.heldItems.length
              ? pokemon.heldItems
                  .map((h) => `${h.name} (${h.rarity})`)
                  .join(", ")
              : "None"
          }
        />
      </Section>

      <Section title="Breeding">
        <InfoRow
          label="Egg groups"
          value={[pokemon.eggGroup1, pokemon.eggGroup2]
            .filter((g) => g !== null)
            .map(titleCase)
            .join(", ")}
        />
        <InfoRow label="Gender" value={genderLabel(pokemon.genderRatio)} />
        <InfoRow
          label="Egg cycles"
          value={`${pokemon.eggCycles} (${(
            pokemon.eggCycles * STEPS_PER_EGG_CYCLE
          ).toLocaleString("en")} steps)`}
        />
      </Section>
    </ScrollView>
  );
}

function Header({ pokemon }: { pokemon: PokemonDetail }) {
  const [shiny, setShiny] = useState(false);
  const sprite = (shiny ? frontShinySprites : frontSprites)[pokemon.id];

  return (
    <View className="items-center gap-2">
      <Pressable
        onPress={() => setShiny((s) => !s)}
        accessibilityRole="button"
        accessibilityLabel={shiny ? "Show normal colours" : "Show shiny"}
      >
        <Image source={sprite} style={{ width: 128, height: 128 }} />
      </Pressable>
      <Text className="text-xs text-neutral-400">
        {shiny ? "Shiny · tap for normal" : "Tap for shiny"}
      </Text>
      <Text className="text-sm text-neutral-500">
        #{String(pokemon.id).padStart(3, "0")} · {pokemon.category} Pokémon
        {pokemon.formName ? ` · ${pokemon.formName}` : ""}
      </Text>
      <View className="flex-row gap-2">
        <TypeBadge type={pokemon.type1} />
        {pokemon.type2 && <TypeBadge type={pokemon.type2} />}
      </View>
      <Text className="text-sm text-neutral-600">
        {formatHeight(pokemon.heightDm)} · {formatWeight(pokemon.weightHg)}
      </Text>
    </View>
  );
}

const LEVELS = [50, 100] as const;

function BaseStats({ pokemon }: { pokemon: PokemonDetail }) {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>(50);
  const total = DISPLAY_STATS.reduce(
    (sum, { stat }) => sum + pokemon.baseStats[stat],
    0,
  );

  return (
    <Section
      title="Base stats"
      action={
        <View className="flex-row gap-1">
          {LEVELS.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLevel(l)}
              accessibilityRole="button"
              accessibilityState={{ selected: l === level }}
              className={`rounded-full px-3 py-1 ${
                l === level ? "bg-neutral-900" : "bg-neutral-100"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  l === level ? "text-white" : "text-neutral-700"
                }`}
              >
                Lv {l}
              </Text>
            </Pressable>
          ))}
        </View>
      }
    >
      {DISPLAY_STATS.map(({ stat, label }) => {
        const base = pokemon.baseStats[stat];
        const { min, max } = statRange(stat, base, level);
        return (
          <View key={stat} className="flex-row items-center gap-2">
            <Text className="w-16 text-sm text-neutral-600">{label}</Text>
            <Text className="w-8 text-right text-sm font-semibold text-neutral-900">
              {base}
            </Text>
            <View className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <View
                className={`h-full rounded-full ${barColour(base)}`}
                // 255 is the highest base stat a Pokémon can have.
                style={{ width: `${(base / 255) * 100}%` }}
              />
            </View>
            <Text className="w-20 text-right text-xs text-neutral-500">
              {min}–{max}
            </Text>
          </View>
        );
      })}
      <View className="flex-row items-center gap-2">
        <Text className="w-16 text-sm text-neutral-600">Total</Text>
        <Text className="w-8 text-right text-sm font-bold text-neutral-900">
          {total}
        </Text>
        <Text className="flex-1 text-right text-xs text-neutral-400">
          Range at Lv {level}: min–max IVs, EVs and nature
        </Text>
      </View>
    </Section>
  );
}

function barColour(base: number): string {
  if (base < 50) return "bg-red-400";
  if (base < 80) return "bg-orange-400";
  if (base < 100) return "bg-yellow-400";
  if (base < 120) return "bg-lime-500";
  return "bg-emerald-500";
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-neutral-900">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row gap-4">
      <Text className="w-32 text-sm text-neutral-500">{label}</Text>
      <Text className="flex-1 text-sm text-neutral-900">{value}</Text>
    </View>
  );
}
