import { Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { SetCard } from "@/components/frontier/set-card";
import { MoveChip } from "@/components/move-chip";
import { Sprite } from "@/components/sprite";
import { TeamsShortcut } from "@/components/teams/teams-shortcut";
import {
  Card,
  Field,
  SearchField,
  SectionTitle,
  Segmented,
  Stepper,
  TABULAR,
  Tag,
} from "@/components/ui";
import { useDb } from "@/db";
import {
  getDomeSets,
  getDomeTrainers,
  getFactoryIvTable,
  getFactorySets,
  getFrontierBrain,
  getPikeWildMons,
  getPossibleSets,
  getPyramidWildMons,
  getTrainersForBattle,
  type FrontierSetDetail,
  type FrontierTrainer,
} from "@/db/frontier-queries";
import {
  battlePosition,
  brainBattle,
  factoryOpponentIv,
  MIN_OPEN_LEVEL,
  narrowBySeen,
  opponentLevel,
  pikeWildLevel,
  pyramidWildLevels,
  type LevelMode,
} from "@/lib/frontier";
import { facilityInfo, type FacilityInfo } from "@/lib/frontier-facilities";
import { useColors } from "@/theme/theme";

/** A possible set, the trainers who can field it and the IVs they use. */
type SetWithIvs = FrontierSetDetail & {
  possibleIvs: number[];
  trainerIds: number[];
};

export default function FacilityScreen() {
  const { facility } = useLocalSearchParams<{ facility: string }>();
  const info = facilityInfo(facility);
  if (!info) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-body text-ink-muted">
          No facility “{facility}”.
        </Text>
      </View>
    );
  }
  return <Facility info={info} />;
}

function Facility({ info }: { info: FacilityInfo }) {
  const db = useDb();
  const [levelMode, setLevelMode] = useState<LevelMode>("50");
  const [battle, setBattle] = useState(1);
  const [streak, setStreak] = useState(0);
  const [towerWins, setTowerWins] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [floor, setFloor] = useState(1);
  const [symbols, setSymbols] = useState<0 | 1 | 2>(0);
  const [partyLevel, setPartyLevel] = useState(MIN_OPEN_LEVEL);
  const level = opponentLevel(levelMode, partyLevel);

  const brain = useMemo(() => getFrontierBrain(db, info.key), [db, info.key]);
  const ivTable = useMemo(() => getFactoryIvTable(db), [db]);

  // Opponents' possible sets (with IVs), or wild Pokémon, for the inputs.
  const result = useMemo(() => {
    switch (info.kind) {
      case "trainers": {
        const t = getTrainersForBattle(db, battle);
        return {
          kind: "sets" as const,
          sets: getPossibleSets(db, { battle, levelMode }),
          trainers: t.trainers,
          summary: trainerSummary(t.trainers),
        };
      }
      case "dome": {
        const t = getDomeTrainers(db, streak);
        return {
          kind: "sets" as const,
          sets: getDomeSets(db, { streak, levelMode }),
          trainers: [...t.regular, ...t.harder],
          summary: trainerSummary([...t.regular, ...t.harder]),
        };
      }
      case "factory": {
        const iv = factoryOpponentIv(ivTable, towerWins, battle);
        return {
          kind: "sets" as const,
          // Factory Pokémon don't depend on the trainer.
          trainers: undefined,
          sets: getFactorySets(db, { battle, levelMode }).sets.map((s) => ({
            ...s,
            possibleIvs: iv === null ? [] : [iv],
            trainerIds: [],
          })),
          summary:
            iv === null
              ? "Any trainer · random IVs"
              : `Any trainer · every IV ${iv}`,
        };
      }
      case "pike":
        return {
          kind: "pike" as const,
          ...getPikeWildMons(db, { levelMode, roomsCleared: cleared }),
        };
      case "pyramid":
        return {
          kind: "pyramid" as const,
          ...getPyramidWildMons(db, {
            levelMode,
            floorsCleared: cleared,
            floor,
          }),
        };
    }
  }, [
    db,
    info.kind,
    battle,
    levelMode,
    streak,
    towerWins,
    cleared,
    floor,
    ivTable,
  ]);

  // Is this battle against the Frontier Brain?
  const brainNow =
    brain &&
    (info.kind === "trainers" ||
      info.kind === "factory" ||
      info.kind === "dome")
      ? brainBattle(brain, info.kind === "dome" ? streak + 1 : battle, symbols)
      : null;

  return (
    <ScrollView
      contentContainerClassName="gap-6 px-4 pb-12 pt-2"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: info.name }} />

      <Card className="gap-5 p-4">
        <Text className="text-callout text-ink-muted">{info.rule}</Text>
        <Segmented
          options={[
            { value: "50", label: "Level 50" },
            { value: "open", label: "Open Level" },
          ]}
          value={levelMode}
          onChange={setLevelMode}
          fill
        />
        {info.kind === "trainers" || info.kind === "factory" ? (
          <Stepper
            label="Battle"
            value={battle}
            min={1}
            onChange={setBattle}
            note={battleNote(battle)}
          />
        ) : info.kind === "dome" ? (
          <Stepper
            label="Tournaments won in a row"
            value={streak}
            min={0}
            big={5}
            onChange={setStreak}
            note={`Tournament ${streak + 1}: 10 opponents from that streak's trainers, 5 from the next tier`}
          />
        ) : (
          <Stepper
            label={info.kind === "pike" ? "Rooms cleared" : "Floors cleared"}
            value={cleared}
            min={0}
            big={info.kind === "pike" ? 14 : 7}
            onChange={setCleared}
          />
        )}
        {info.kind === "factory" && (
          <Stepper
            label="Your Battle Tower Level 50 wins"
            value={towerWins}
            min={0}
            onChange={setTowerWins}
            note="A game bug: Factory opponents' IVs follow your Battle Tower Level 50 streak."
          />
        )}
        {info.kind === "pyramid" && (
          <Field label="Floor">
            <Segmented
              options={[1, 2, 3, 4, 5, 6, 7].map((f) => ({
                value: f,
                label: String(f),
              }))}
              value={floor}
              onChange={setFloor}
              fill
            />
          </Field>
        )}
        {brain && info.kind !== "pike" && info.kind !== "pyramid" && (
          <Field label={`Symbols won from ${brain.name}`}>
            <Segmented
              options={[
                { value: 0, label: "None" },
                { value: 1, label: "Silver" },
                { value: 2, label: "Both" },
              ]}
              value={symbols}
              onChange={(v) => setSymbols(v as 0 | 1 | 2)}
              fill
            />
          </Field>
        )}
        {levelMode === "open" && (
          <Stepper
            label="Your highest level"
            value={partyLevel}
            min={50}
            max={100}
            big={10}
            onChange={setPartyLevel}
            note={`Open Level opponents match your highest level, but are at least Lv ${MIN_OPEN_LEVEL}.`}
          />
        )}
      </Card>

      {brain && (
        <BrainCard
          // Re-opened on the right team whenever the battle becomes (or stops
          // being) a Brain battle.
          key={String(brainNow)}
          brain={brain}
          info={info}
          now={brainNow}
          unit={UNITS[info.kind]}
          level={level}
        />
      )}

      {/* The Factory lends you Pokémon, so there are no teams to save. */}
      {info.key !== "factory" && (
        <TeamsShortcut purpose={info.key} game="emerald" />
      )}

      {brainNow ? null : result.kind === "sets" ? (
        <SetsExplorer
          key={`${battle}-${streak}-${levelMode}`}
          sets={result.sets}
          trainers={result.trainers}
          summary={result.summary}
          level={level}
          info={info}
        />
      ) : result.kind === "pike" ? (
        <WildList
          title={`Wild Pokémon, tier ${result.tier + 1}`}
          mons={result.mons.map((m) => ({
            ...m,
            levels: String(pikeWildLevel(levelMode, m.levelDelta, partyLevel)),
          }))}
        />
      ) : (
        <WildList
          title={`Wild Pokémon, floor ${floor} of round ${result.round + 1}`}
          mons={result.mons.map((m) => {
            const l = pyramidWildLevels(levelMode, m.level, partyLevel);
            return { ...m, levels: `${l.min}–${l.max}` };
          })}
        />
      )}
    </ScrollView>
  );
}

/** What a facility's streak counts, for the Brain's schedule. */
const UNITS: Record<FacilityInfo["kind"], string> = {
  trainers: "battle",
  factory: "battle",
  dome: "tournament",
  pike: "room",
  pyramid: "floor",
};

function trainerSummary(trainers: { fixedIv: number }[]) {
  const ivs = [...new Set(trainers.map((t) => t.fixedIv))].sort(
    (a, b) => a - b,
  );
  return `${trainers.length} possible trainers · IVs ${ivs.join(", ")}`;
}

function battleNote(battle: number) {
  const p = battlePosition(battle);
  return `Challenge ${p.challenge + 1}, battle ${p.battleInChallenge} of 7${
    p.lastBattle ? " · the 7th battle draws harder trainers" : ""
  }`;
}

/**
 * Every species the opponents can field, as a sprite grid; tap one to see
 * its possible sets with real stats. Marking a Pokémon as sent out narrows
 * everything to the trainers who could have it (narrowBySeen).
 */
function SetsExplorer({
  sets,
  trainers,
  summary,
  level,
  info,
}: {
  sets: SetWithIvs[];
  /** Who the sets belong to; without it (the Factory) nothing narrows. */
  trainers?: FrontierTrainer[];
  summary: string;
  level: number;
  info: FacilityInfo;
}) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [seen, setSeen] = useState<number[]>([]);

  const narrowed = trainers
    ? narrowBySeen(
        sets,
        seen,
        (id) => trainers.find((t) => t.id === id)?.fixedIv,
      )
    : { trainerIds: [], sets };
  const fitting = trainers?.filter((t) => narrowed.trainerIds.includes(t.id));
  const nameOf = (id: number) =>
    sets.find((s) => s.pokemonId === id)?.species ?? "This Pokémon";

  // What's left to see: the fitting trainers' Pokémon, minus those seen (a
  // team never has the same species twice).
  const byId = new Map<number, { id: number; name: string; count: number }>();
  for (const s of narrowed.sets) {
    if (seen.includes(s.pokemonId)) continue;
    const e = byId.get(s.pokemonId) ?? {
      id: s.pokemonId,
      name: s.species,
      count: 0,
    };
    e.count++;
    byId.set(s.pokemonId, e);
  }
  const species = [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const q = query.trim().toLowerCase();
  const shown = q
    ? species.filter((s) => s.name.toLowerCase().includes(q))
    : species;
  const pickedSets =
    picked === null ? [] : narrowed.sets.filter((s) => s.pokemonId === picked);
  const pickedSeen = picked !== null && seen.includes(picked);

  return (
    <View className="gap-3">
      <View className="gap-0.5">
        <SectionTitle>{`Lv ${level} opponents can send out`}</SectionTitle>
        <Text className="px-1 text-callout text-ink-muted">
          {seen.length === 0
            ? `${summary} · ${species.length} species, ${sets.length} sets`
            : "Narrowed by what they’ve sent out"}
        </Text>
      </View>

      {seen.length > 0 && fitting && (
        <Card className="gap-3 p-4">
          <View className="flex-row flex-wrap gap-2">
            {seen.map((id) => (
              <View
                key={id}
                className="h-11 flex-row items-center rounded-full bg-sunken pl-1"
              >
                <Pressable
                  onPress={() => setPicked(id)}
                  className="flex-row items-center gap-1 active:opacity-60"
                >
                  <Sprite id={id} size={40} game="emerald" />
                  <Text className="text-callout font-semibold text-ink">
                    {nameOf(id)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSeen(seen.filter((s) => s !== id))}
                  aria-label={`Remove ${nameOf(id)}`}
                  role="button"
                  className="h-11 w-10 items-center justify-center active:opacity-60"
                >
                  <SymbolView
                    name={{ ios: "xmark", android: "close", web: "close" }}
                    tintColor={colors["ink-muted"]}
                    size={16}
                  />
                </Pressable>
              </View>
            ))}
          </View>
          {fitting.length === 0 ? (
            <Text className="text-callout text-ink-muted">
              No trainer at this point has all of these. Remove one to see the
              rest again.
            </Text>
          ) : (
            <Text className="text-callout text-ink-muted">
              <Text className="font-semibold text-ink">
                {fitting.length === 1
                  ? `${fitting[0]!.trainerClass} ${fitting[0]!.name}`
                  : `${fitting.length} trainers`}
              </Text>
              {fitting.length === 1 ? " is" : " are"} the only{" "}
              {fitting.length === 1 ? "one" : "ones"} with{" "}
              {seen.length === 1 ? "it" : "all of them"}
              {fitting.length > 1 && fitting.length <= 4
                ? `: ${fitting.map((t) => `${t.trainerClass} ${t.name}`).join(", ")}`
                : ""}
              . Every IV is{" "}
              {[...new Set(fitting.map((t) => t.fixedIv))]
                .sort((a, b) => a - b)
                .join(" or ")}
              . {species.length} other species possible.
            </Text>
          )}
        </Card>
      )}

      {picked === null && (
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Which Pokémon did they send out?"
        />
      )}
      {picked !== null && (
        <View className="gap-2">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-body font-semibold text-ink">
              {nameOf(picked)} has {pickedSets.length}{" "}
              {pickedSets.length === 1 ? "set" : "sets"}
            </Text>
            <Pressable
              onPress={() => setPicked(null)}
              hitSlop={8}
              role="button"
              className="active:opacity-60"
            >
              <Text className="text-body font-semibold text-accent">
                All species
              </Text>
            </Pressable>
          </View>
          {trainers && !pickedSeen && (
            <Pressable
              onPress={() => {
                setSeen([...seen, picked]);
                setPicked(null);
                setQuery("");
              }}
              role="button"
              className="h-12 flex-row items-center justify-center gap-2 rounded-tile bg-accent active:opacity-60"
            >
              <SymbolView
                name={{
                  ios: "eye.fill",
                  android: "visibility",
                  web: "visibility",
                }}
                tintColor={colors["on-accent"]}
                size={20}
              />
              <Text className="text-body font-semibold text-on-accent">
                They sent this out
              </Text>
            </Pressable>
          )}
          {pickedSets.map((s) => (
            <SetCard
              key={s.id}
              set={s}
              level={level}
              ivs={s.possibleIvs}
              accent={info.color}
            />
          ))}
        </View>
      )}
      {picked === null && (
        <View className="flex-row flex-wrap gap-2">
          {shown.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setPicked(s.id)}
              className="w-[23%] flex-grow items-center rounded-tile bg-surface pb-2 pt-1 active:opacity-60"
            >
              <Sprite id={s.id} size={56} game="emerald" />
              <Text
                className="px-1 text-micro font-semibold text-ink"
                numberOfLines={1}
              >
                {s.name}
              </Text>
              <Text className="text-micro text-ink-subtle">
                {s.count} {s.count === 1 ? "set" : "sets"}
              </Text>
            </Pressable>
          ))}
          {shown.length === 0 && q !== "" && (
            <Text className="flex-1 p-6 text-center text-body text-ink-muted">
              No opponent here uses “{query}”.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

type Brain = NonNullable<ReturnType<typeof getFrontierBrain>>;

/** The Frontier Brain: when you meet them, and their two fixed teams. */
function BrainCard({
  brain,
  info,
  now,
  unit,
  level,
}: {
  brain: Brain;
  info: FacilityInfo;
  now: "silver" | "gold" | null;
  unit: string;
  level: number;
}) {
  const [symbol, setSymbol] = useState<"silver" | "gold">(now ?? "silver");
  const [open, setOpen] = useState(now !== null);
  const colors = useColors();
  const first = (at: number) => at - brain.streakOffset + 1;
  const team = symbol === "silver" ? brain.silver : brain.gold;
  return (
    <View
      className="gap-3 rounded-card p-4"
      style={{ backgroundColor: `${info.color}${now ? "2E" : "1A"}` }}
    >
      <Pressable
        onPress={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex-row items-center gap-3 active:opacity-60"
      >
        <View className="flex-1 gap-0.5">
          <Text className="text-caption font-semibold text-ink-muted">
            {now
              ? `This ${unit} is against the Frontier Brain`
              : "Frontier Brain"}
          </Text>
          <Text className="text-headline font-bold text-ink">
            {brain.trainerClass} {brain.name}
          </Text>
          <Text className="text-callout text-ink-muted">
            Silver Symbol at {unit} {first(brain.silverAt)}, Gold at{" "}
            {first(brain.goldAt)}, then every {brain.repeatEvery}. Singles only.
          </Text>
        </View>
        <SymbolView
          name={{
            ios: open ? "chevron.up" : "chevron.down",
            android: open ? "expand_less" : "expand_more",
            web: open ? "expand_less" : "expand_more",
          }}
          tintColor={colors["ink-subtle"]}
          size={22}
        />
      </Pressable>
      {open && team.length > 0 && (
        <>
          <Segmented
            options={[
              { value: "silver", label: "Silver team" },
              { value: "gold", label: "Gold team" },
            ]}
            value={symbol}
            onChange={setSymbol}
            fill
          />
          {team.map((m) => (
            <SetCard
              key={m.slot}
              set={m}
              level={level}
              ivs={[m.fixedIv]}
              accent={info.color}
              brain={{ brain: info.key, symbol, slot: m.slot }}
            />
          ))}
        </>
      )}
      {open && team.length === 0 && (
        <Text className="text-callout text-ink-muted">
          {brain.name} rents from the same pool as the other trainers.
        </Text>
      )}
    </View>
  );
}

/** Pike / Pyramid wild Pokémon with their chance and level. */
function WildList({
  title,
  mons,
}: {
  title: string;
  mons: {
    pokemonId: number;
    species: string;
    rate: number;
    levels: string;
    moves: string[];
  }[];
}) {
  return (
    <View className="gap-2">
      <SectionTitle>{title}</SectionTitle>
      {mons.map((m, i) => (
        <Card key={`${m.pokemonId}-${i}`} className="flex-row gap-3 p-3">
          <Sprite id={m.pokemonId} size={56} game="emerald" />
          <View className="flex-1 gap-1.5">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-body font-bold text-ink">
                {m.species}
              </Text>
              <Tag>{`Lv ${m.levels}`}</Tag>
              <Text
                className="w-10 text-right text-body font-bold text-ink"
                style={TABULAR}
              >
                {m.rate}%
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-1">
              {m.moves.map((mv, j) => (
                <MoveChip key={`${mv}-${j}`} name={mv} />
              ))}
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}
