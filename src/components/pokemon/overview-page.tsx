import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { PokedexEntry, PokemonDetail } from "@/db/queries";
import type { Game, Stat } from "@/db/schema";
import { captureChance } from "@/lib/catch-rate";
import { gamesLabel } from "@/lib/games";
import { femaleShare, genderLabel, titleCase } from "@/lib/pokemon-format";
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

/** The Overview tab: Pokédex text, stats, and values from the game's formulas. */
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
    .join(" · ");
  const female = femaleShare(pokemon.genderRatio);
  const eggGroups = [pokemon.eggGroup1, pokemon.eggGroup2]
    .filter((g) => g !== null)
    .map(titleCase)
    .join(", ");

  return (
    <View className="gap-3 p-3 pb-12">
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

      <View className="flex-row gap-3">
        <MiniCard
          label="Catch rate"
          value={`${(captureChance(pokemon.catchRate) * 100).toFixed(1)}%`}
          note={`Poké Ball, full HP · rate ${pokemon.catchRate}`}
        />
        <MiniCard label="Gender" note={genderLabel(pokemon.genderRatio)}>
          {female === null ? (
            <View className="my-2.5 h-2 rounded-full bg-sunken" />
          ) : (
            <View className="my-2.5 h-2 flex-row overflow-hidden rounded-full">
              <View className="bg-blue-400" style={{ flex: 1 - female }} />
              <View className="bg-pink-400" style={{ flex: female }} />
            </View>
          )}
        </MiniCard>
      </View>
      <View className="flex-row gap-3">
        <MiniCard
          label="Hatch"
          value={(pokemon.eggCycles * STEPS_PER_EGG_CYCLE).toLocaleString("en")}
          note={`steps · ${eggGroups}`}
        />
        <MiniCard
          label="EV yield"
          value={evYield}
          note={`Base friendship ${pokemon.baseFriendship}`}
        />
      </View>

      <Section title="Abilities">
        {pokemon.abilities.map((a) => (
          <View key={a.id} className="gap-0.5">
            <Text className="font-bold text-ink">{a.name}</Text>
            <Text className="text-sm text-ink-muted">{a.description}</Text>
          </View>
        ))}
      </Section>

      <Section title="More">
        <InfoRow label="Base exp." value={String(pokemon.baseExperience)} />
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
    </View>
  );
}

/** A small card for one computed value. */
function MiniCard({
  label,
  value,
  note,
  children,
}: {
  label: string;
  value?: string;
  note: string;
  children?: ReactNode;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-line bg-surface p-3">
      <Text className="text-[10px] font-extrabold uppercase tracking-widest text-ink-subtle">
        {label}
      </Text>
      {value !== undefined && (
        <Text className="mt-0.5 text-xl font-black text-ink">{value}</Text>
      )}
      {children}
      <Text className="text-xs text-ink-muted">{note}</Text>
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
