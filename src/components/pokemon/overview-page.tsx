import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import {
  Card,
  Divider,
  Label,
  SectionTitle,
  Segmented,
  TABULAR,
} from "@/components/ui";
import type { PokedexEntry, PokemonDetail } from "@/db/queries";
import type { Game, Stat } from "@/db/schema";
import { captureChance } from "@/lib/catch-rate";
import { gamesLabel } from "@/lib/games";
import { femaleShare, genderLabel, titleCase } from "@/lib/pokemon-format";
import { statRange } from "@/lib/stats";

/** The order Pokédex apps show stats in (the games store Speed fourth). */
const DISPLAY_STATS: { stat: Stat; label: string }[] = [
  { stat: "hp", label: "HP" },
  { stat: "attack", label: "Attack" },
  { stat: "defense", label: "Defense" },
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
    .join(", ");
  const female = femaleShare(pokemon.genderRatio);
  const eggGroups = [pokemon.eggGroup1, pokemon.eggGroup2]
    .filter((g) => g !== null)
    .map(titleCase)
    .join(", ");
  // The current game's text leads; the other versions follow, quieter.
  const sorted = [...entries].sort(
    (a, b) => Number(b.games.includes(game)) - Number(a.games.includes(game)),
  );

  return (
    <View className="gap-6 px-4 pb-12 pt-5">
      <View className="gap-2">
        <SectionTitle>Pokédex entry</SectionTitle>
        <Card>
          {sorted.map((entry, i) => {
            const current = entry.games.includes(game);
            return (
              <View key={entry.games.join()}>
                {i > 0 && <Divider className="ml-4" />}
                <View className="gap-1 p-4">
                  <Text
                    className={`text-caption font-semibold ${
                      current ? "text-accent" : "text-ink-subtle"
                    }`}
                  >
                    {gamesLabel(entry.games)}
                  </Text>
                  <Text
                    className={`text-body ${
                      current ? "text-ink" : "text-ink-muted"
                    }`}
                  >
                    {entry.text}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>
      </View>

      <BaseStats pokemon={pokemon} />

      <View className="gap-2">
        <SectionTitle>Training</SectionTitle>
        <View className="flex-row gap-2">
          <Figure
            label="Catch chance"
            value={`${(captureChance(pokemon.catchRate) * 100).toFixed(1)}%`}
            note={`Poké Ball at full HP (rate ${pokemon.catchRate})`}
          />
          <Figure label="Gender" note={genderLabel(pokemon.genderRatio)}>
            {female === null ? (
              <View className="my-3 h-2 rounded-full bg-sunken" />
            ) : (
              <View className="my-3 h-2 flex-row gap-0.5 overflow-hidden rounded-full">
                <View className="bg-blue-400" style={{ flex: 1 - female }} />
                <View className="bg-pink-400" style={{ flex: female }} />
              </View>
            )}
          </Figure>
        </View>
        <View className="flex-row gap-2">
          <Figure
            label="Steps to hatch"
            value={(pokemon.eggCycles * STEPS_PER_EGG_CYCLE).toLocaleString(
              "en",
            )}
            note={`Egg group: ${eggGroups}`}
          />
          <Figure
            label="EV yield"
            value={evYield}
            note={`Base friendship ${pokemon.baseFriendship}`}
          />
        </View>
      </View>

      <View className="gap-2">
        <SectionTitle>Abilities</SectionTitle>
        <Card>
          {pokemon.abilities.map((a, i) => (
            <View key={a.id}>
              {i > 0 && <Divider className="ml-4" />}
              <View className="gap-0.5 p-4">
                <Text className="text-body font-semibold text-ink">
                  {a.name}
                </Text>
                <Text className="text-callout text-ink-muted">
                  {a.description}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View className="gap-2">
        <SectionTitle>More</SectionTitle>
        <Card>
          <InfoRow label="Base experience" value={pokemon.baseExperience} />
          <Divider className="ml-4" />
          <InfoRow label="Growth rate" value={titleCase(pokemon.growthRate)} />
          <Divider className="ml-4" />
          <InfoRow
            label="Held in the wild"
            value={
              pokemon.heldItems.length
                ? pokemon.heldItems
                    .map((h) => `${h.name} (${h.rarity})`)
                    .join(", ")
                : "Nothing"
            }
          />
        </Card>
      </View>
    </View>
  );
}

/** A tile for one computed value. */
function Figure({
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
    <Card className="flex-1 p-4">
      <Label>{label}</Label>
      {value !== undefined && (
        <Text
          className="mt-1 text-title font-bold tracking-tight text-ink"
          style={TABULAR}
        >
          {value}
        </Text>
      )}
      {children}
      <Text className="mt-0.5 text-caption text-ink-subtle">{note}</Text>
    </Card>
  );
}

const LEVELS = [50, 100] as const;
const LEVEL_OPTIONS = LEVELS.map((l) => ({ value: l, label: `Lv ${l}` }));

function BaseStats({ pokemon }: { pokemon: PokemonDetail }) {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>(50);
  const total = DISPLAY_STATS.reduce(
    (sum, { stat }) => sum + pokemon.baseStats[stat],
    0,
  );

  return (
    <View className="gap-2">
      <SectionTitle
        action={
          <Segmented
            options={LEVEL_OPTIONS}
            value={level}
            onChange={setLevel}
            small
          />
        }
      >
        Base stats
      </SectionTitle>
      <Card className="gap-3 p-4">
        {DISPLAY_STATS.map(({ stat, label }) => {
          const base = pokemon.baseStats[stat];
          const { min, max } = statRange(stat, base, level);
          return (
            <View key={stat} className="flex-row items-center gap-3">
              <Text className="w-16 text-callout text-ink-muted">{label}</Text>
              <Text
                className="w-8 text-right text-callout font-bold text-ink"
                style={TABULAR}
              >
                {base}
              </Text>
              <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                <View
                  className={`h-full rounded-full ${barColour(base)}`}
                  // 255 is the highest base stat a Pokémon can have.
                  style={{ width: `${(base / 255) * 100}%` }}
                />
              </View>
              <Text
                className="w-[68px] text-right text-caption text-ink-subtle"
                style={TABULAR}
              >
                {min}–{max}
              </Text>
            </View>
          );
        })}
        <Divider />
        <View className="flex-row items-center gap-3">
          <Text className="w-16 text-callout text-ink-muted">Total</Text>
          <Text
            className="w-8 text-right text-callout font-bold text-ink"
            style={TABULAR}
          >
            {total}
          </Text>
          <Text className="flex-1 text-right text-caption text-ink-subtle">
            Right: lowest to highest at Lv {level}
          </Text>
        </View>
      </Card>
    </View>
  );
}

function barColour(base: number): string {
  if (base < 50) return "bg-red-400";
  if (base < 80) return "bg-orange-400";
  if (base < 100) return "bg-yellow-400";
  if (base < 120) return "bg-lime-500";
  return "bg-emerald-500";
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-row items-baseline gap-4 px-4 py-3">
      <Text className="text-body text-ink-muted">{label}</Text>
      <Text className="flex-1 text-right text-body font-semibold text-ink">
        {value}
      </Text>
    </View>
  );
}
