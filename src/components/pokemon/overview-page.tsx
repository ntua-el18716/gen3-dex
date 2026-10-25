import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { dexNumber } from "@/components/pokemon-row";
import { Sprite } from "@/components/sprite";
import { TYPE_TINT, TypeBadge } from "@/components/type-badge";
import type { PokedexEntry, PokemonDetail } from "@/db/queries";
import type { Game, Stat } from "@/db/schema";
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
    <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
      <Header pokemon={pokemon} />

      <Section title="Pokédex">
        {entries.map((entry) => {
          const current = entry.games.includes(game);
          return (
            <View
              key={entry.games.join()}
              className={`gap-1 rounded-xl p-3 ${current ? "bg-sunken" : ""}`}
            >
              <Text
                className={`text-xs font-bold tracking-wider ${
                  current ? "text-accent" : "text-ink-subtle"
                }`}
              >
                {gamesLabel(entry.games)}
              </Text>
              <Text
                className={`text-sm leading-5 ${
                  current ? "text-ink" : "text-ink-muted"
                }`}
              >
                {entry.text}
              </Text>
            </View>
          );
        })}
      </Section>

      <BaseStats pokemon={pokemon} />

      <Section title="Abilities">
        {pokemon.abilities.map((a) => (
          <View key={a.id} className="gap-0.5">
            <Text className="font-bold text-ink">{a.name}</Text>
            <Text className="text-sm text-ink-muted">{a.description}</Text>
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

  return (
    <View
      className={`items-center gap-3 overflow-hidden rounded-3xl border border-line px-4 pb-5 pt-3 ${TYPE_TINT[pokemon.type1]}`}
    >
      <View className="w-full flex-row items-center justify-between">
        <Text className="text-sm font-bold text-ink-muted">
          {dexNumber(pokemon.id)}
        </Text>
        <Pressable
          onPress={() => setShiny((s) => !s)}
          // aria-* props work on native and, unlike accessibilityState,
          // reach the HTML on web.
          role="switch"
          aria-checked={shiny}
          aria-label="Shiny"
          className={`rounded-full px-3 py-1 ${shiny ? "bg-accent" : "bg-surface/70"}`}
        >
          <Text
            className={`text-xs font-bold ${shiny ? "text-on-accent" : "text-ink-muted"}`}
          >
            ✦ Shiny
          </Text>
        </Pressable>
      </View>
      {/* Tapping the sprite toggles the shiny too. */}
      <Pressable
        onPress={() => setShiny((s) => !s)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Sprite id={pokemon.id} size={192} shiny={shiny} />
      </Pressable>
      <View className="items-center gap-1">
        <Text className="text-sm text-ink-muted">
          {pokemon.category} Pokémon
          {pokemon.formName ? ` · ${pokemon.formName}` : ""}
        </Text>
        <View className="flex-row gap-2">
          <TypeBadge type={pokemon.type1} />
          {pokemon.type2 && <TypeBadge type={pokemon.type2} />}
        </View>
      </View>
      <View className="flex-row gap-2">
        <Measure label="Height" value={formatHeight(pokemon.heightDm)} />
        <Measure label="Weight" value={formatWeight(pokemon.weightHg)} />
      </View>
    </View>
  );
}

function Measure({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-24 items-center rounded-xl bg-surface/70 px-4 py-2">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
        {label}
      </Text>
      <Text className="text-base font-bold text-ink">{value}</Text>
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
                l === level ? "bg-accent" : "bg-sunken"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  l === level ? "text-on-accent" : "text-ink-muted"
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
            <Text className="w-16 text-sm text-ink-muted">{label}</Text>
            <Text className="w-8 text-right text-sm font-bold text-ink">
              {base}
            </Text>
            <View className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
              <View
                className={`h-full rounded-full ${barColour(base)}`}
                // 255 is the highest base stat a Pokémon can have.
                style={{ width: `${(base / 255) * 100}%` }}
              />
            </View>
            <Text className="w-20 text-right text-xs text-ink-subtle">
              {min}–{max}
            </Text>
          </View>
        );
      })}
      <View className="flex-row items-center gap-2 border-t border-line pt-3">
        <Text className="w-16 text-sm font-bold text-ink-muted">Total</Text>
        <Text className="w-8 text-right text-sm font-bold text-ink">
          {total}
        </Text>
        <Text className="flex-1 text-right text-xs text-ink-subtle">
          Lv {level} range: worst–best IVs, EVs, nature
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
    <View className="gap-3 rounded-2xl border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-ink">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row gap-4">
      <Text className="w-32 text-sm text-ink-muted">{label}</Text>
      <Text className="flex-1 text-sm font-semibold text-ink">{value}</Text>
    </View>
  );
}
