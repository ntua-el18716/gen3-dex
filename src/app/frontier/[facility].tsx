import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Segmented, Stepper } from "@/components/frontier/controls";
import { SetCard } from "@/components/frontier/set-card";
import { MoveChip } from "@/components/move-chip";
import { Sprite } from "@/components/sprite";
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
} from "@/db/frontier-queries";
import {
  battlePosition,
  brainBattle,
  factoryOpponentIv,
  MIN_OPEN_LEVEL,
  opponentLevel,
  pikeWildLevel,
  pyramidWildLevels,
  type LevelMode,
} from "@/lib/frontier";
import { facilityInfo, type FacilityInfo } from "@/lib/frontier-facilities";
import { useColors } from "@/theme/theme";

type SetWithIvs = FrontierSetDetail & { possibleIvs: number[] };

export default function FacilityScreen() {
  const { facility } = useLocalSearchParams<{ facility: string }>();
  const info = facilityInfo(facility);
  if (!info) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-ink-muted">No facility “{facility}”.</Text>
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
          sets: getPossibleSets(db, { battle, levelMode }) as SetWithIvs[],
          summary: trainerSummary(t.trainers),
        };
      }
      case "dome": {
        const t = getDomeTrainers(db, streak);
        return {
          kind: "sets" as const,
          sets: getDomeSets(db, { streak, levelMode }) as SetWithIvs[],
          summary: trainerSummary([...t.regular, ...t.harder]),
        };
      }
      case "factory": {
        const iv = factoryOpponentIv(ivTable, towerWins, battle);
        return {
          kind: "sets" as const,
          sets: getFactorySets(db, { battle, levelMode }).sets.map((s) => ({
            ...s,
            possibleIvs: iv === null ? [] : [iv],
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
      contentContainerClassName="gap-3 p-3 pb-12"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: info.name }} />

      <Card>
        <Text className="text-sm text-ink-muted">{info.rule}</Text>
        <Segmented
          options={[
            { value: "50", label: "Level 50" },
            { value: "open", label: "Open Level" },
          ]}
          value={levelMode}
          onChange={setLevelMode}
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
            label="Your Battle Tower Lv 50 wins"
            value={towerWins}
            min={0}
            onChange={setTowerWins}
            note="A game bug: Factory opponents' IVs follow your Battle Tower Level 50 streak."
          />
        )}
        {info.kind === "pyramid" && (
          <View className="gap-1.5">
            <Text className="text-[10px] font-extrabold uppercase tracking-widest text-ink-subtle">
              Floor
            </Text>
            <Segmented
              options={[1, 2, 3, 4, 5, 6, 7].map((f) => ({
                value: f,
                label: String(f),
              }))}
              value={floor}
              onChange={setFloor}
            />
          </View>
        )}
        {brain && info.kind !== "pike" && info.kind !== "pyramid" && (
          <View className="gap-1.5">
            <Text className="text-[10px] font-extrabold uppercase tracking-widest text-ink-subtle">
              {brain.name}&apos;s Symbols you have
            </Text>
            <Segmented
              options={[
                { value: 0, label: "None" },
                { value: 1, label: "Silver" },
                { value: 2, label: "Both" },
              ]}
              value={symbols}
              onChange={(v) => setSymbols(v as 0 | 1 | 2)}
            />
          </View>
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
        <Text className="text-xs text-ink-subtle">
          Opponents are Lv {level}.
        </Text>
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

      {brainNow ? null : result.kind === "sets" ? (
        <SetsExplorer
          key={`${battle}-${streak}-${levelMode}`}
          sets={result.sets}
          summary={result.summary}
          level={level}
          info={info}
        />
      ) : result.kind === "pike" ? (
        <WildList
          title={`Wild Pokémon · tier ${result.tier + 1}`}
          mons={result.mons.map((m) => ({
            ...m,
            levels: String(pikeWildLevel(levelMode, m.levelDelta, partyLevel)),
          }))}
        />
      ) : (
        <WildList
          title={`Wild Pokémon · floor ${floor} · round ${result.round + 1}`}
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

function Card({ children }: { children: ReactNode }) {
  return (
    <View className="gap-3.5 rounded-[20px] border border-line bg-surface p-4">
      {children}
    </View>
  );
}

/**
 * Every species the opponents can field, as a sprite grid; tap one to see
 * its possible sets with real stats.
 */
function SetsExplorer({
  sets,
  summary,
  level,
  info,
}: {
  sets: SetWithIvs[];
  summary: string;
  level: number;
  info: FacilityInfo;
}) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const species = useMemo(() => {
    const byId = new Map<number, { id: number; name: string; count: number }>();
    for (const s of sets) {
      const e = byId.get(s.pokemonId) ?? {
        id: s.pokemonId,
        name: s.species,
        count: 0,
      };
      e.count++;
      byId.set(s.pokemonId, e);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sets]);
  const q = query.trim().toLowerCase();
  const shown = q
    ? species.filter((s) => s.name.toLowerCase().includes(q))
    : species;
  const pickedSets =
    picked === null ? [] : sets.filter((s) => s.pokemonId === picked);

  return (
    <View className="gap-3">
      <View className="px-1">
        <Text className="text-xs font-extrabold uppercase tracking-widest text-ink-subtle">
          What they can send out
        </Text>
        <Text className="text-xs text-ink-muted">
          {summary} · {species.length} species, {sets.length} sets
        </Text>
      </View>
      <TextInput
        className="rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink"
        placeholder="Which Pokémon did they send out?"
        placeholderTextColor={colors["ink-subtle"]}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {picked !== null && (
        <View className="gap-2.5">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-sm font-bold text-ink">
              {pickedSets[0]?.species ?? "This Pokémon"} · {pickedSets.length}{" "}
              {pickedSets.length === 1 ? "set" : "sets"}
            </Text>
            <Pressable
              onPress={() => setPicked(null)}
              hitSlop={8}
              role="button"
            >
              <Text className="text-sm font-bold" style={{ color: info.color }}>
                Show all
              </Text>
            </Pressable>
          </View>
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
        <View className="flex-row flex-wrap gap-1.5">
          {shown.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setPicked(s.id)}
              className="w-[23.5%] items-center rounded-2xl border border-line bg-surface py-1.5 active:opacity-70"
            >
              <Sprite id={s.id} size={56} game="emerald" />
              <Text
                className="px-1 text-[11px] font-bold text-ink"
                numberOfLines={1}
              >
                {s.name}
              </Text>
              <Text className="text-[10px] text-ink-subtle">
                {s.count} {s.count === 1 ? "set" : "sets"}
              </Text>
            </Pressable>
          ))}
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
  const first = (at: number) => at - brain.streakOffset + 1;
  const team = symbol === "silver" ? brain.silver : brain.gold;
  return (
    <View
      className="gap-3 rounded-[20px] border-2 p-4"
      style={{ borderColor: info.color, backgroundColor: `${info.color}14` }}
    >
      <Pressable
        onPress={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="gap-0.5"
      >
        <Text
          className="text-[10px] font-extrabold uppercase tracking-widest"
          style={{ color: info.color }}
        >
          {now ? `This ${unit}: Frontier Brain (${now})` : "Frontier Brain"}
        </Text>
        <Text className="text-xl font-black text-ink">
          {brain.trainerClass} {brain.name}
        </Text>
        <Text className="text-xs text-ink-muted">
          Silver Symbol at {unit} {first(brain.silverAt)} · Gold at {unit}{" "}
          {first(brain.goldAt)}, then every {brain.repeatEvery} · singles only
        </Text>
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
          />
          {team.map((m) => (
            <SetCard
              key={m.slot}
              set={m}
              level={level}
              ivs={[m.fixedIv]}
              accent={info.color}
            />
          ))}
        </>
      )}
      {open && team.length === 0 && (
        <Text className="text-xs text-ink-muted">
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
    <View className="gap-2.5">
      <Text className="px-1 text-xs font-extrabold uppercase tracking-widest text-ink-subtle">
        {title}
      </Text>
      {mons.map((m, i) => (
        <View
          key={`${m.pokemonId}-${i}`}
          className="flex-row gap-3 rounded-[20px] border border-line bg-surface p-3"
        >
          <Sprite id={m.pokemonId} size={56} game="emerald" />
          <View className="flex-1 gap-1">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-base font-black text-ink">{m.species}</Text>
              <Text className="text-sm font-black text-ink">{m.rate}%</Text>
            </View>
            <Text className="text-xs text-ink-muted">Lv {m.levels}</Text>
            <View className="flex-row flex-wrap gap-1">
              {m.moves.map((mv, j) => (
                <MoveChip key={`${mv}-${j}`} name={mv} />
              ))}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
