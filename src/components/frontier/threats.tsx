import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Sprite } from "@/components/sprite";
import { PurposeIcon } from "@/components/teams/purpose-icon";
import { Card, Divider, Pills, TABULAR } from "@/components/ui";
import { useDb } from "@/db";
import {
  getSetCombatants,
  getTeamCombatants,
  getTypeChart,
  type Combatant,
} from "@/db/damage-queries";
import type { FrontierFacility } from "@/db/schema";
import type { Team } from "@/lib/teams";
import { assessThreats, type Threat, type ThreatFoe } from "@/lib/threats";
import { useTeams } from "@/state/teams";
import { useColors } from "@/theme/theme";

/** How many threats a member shows before "Show all". */
const SHOWN = 5;

/**
 * "Threats to your team": for each Pokémon of one of your teams, which of
 * the sets the opponent can have right now knock it out or hit it hard
 * (lib/threats.ts). Folded until opened, because it weighs every set
 * against every member.
 */
export function ThreatList({
  sets,
  level,
  facility,
}: {
  /** The sets possible now (already narrowed), with the IVs they can have. */
  sets: { id: number; possibleIvs: number[] }[];
  level: number;
  facility: FrontierFacility;
}) {
  const colors = useColors();
  const { teams } = useTeams();
  const [open, setOpen] = useState(false);
  // Teams made for this facility first, then any other with Pokémon.
  const usable = teams
    .filter((t) => t.members.length > 0)
    .sort(
      (a, b) => Number(b.purpose === facility) - Number(a.purpose === facility),
    );
  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const team = usable.find((t) => t.id === teamId) ?? usable[0];

  return (
    <Card>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-sunken"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-red-500/15">
          <SymbolView
            name={{
              ios: "exclamationmark.shield.fill",
              android: "gpp_maybe",
              web: "gpp_maybe",
            }}
            tintColor="#EF4444"
            size={20}
          />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-body font-semibold text-ink">
            Threats to your team
          </Text>
          <Text className="text-caption text-ink-muted">
            Which of these {sets.length} sets can knock out each of your Pokémon
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
      {open &&
        (team ? (
          <View className="gap-4 pb-4">
            {usable.length > 1 && (
              <View className="px-4">
                <Pills
                  options={usable.map((t) => ({
                    value: t.id,
                    label: t.name || "Untitled team",
                    left: (
                      <PurposeIcon
                        purpose={t.purpose}
                        game={t.game}
                        size={32}
                      />
                    ),
                  }))}
                  value={team.id}
                  onChange={setTeamId}
                />
              </View>
            )}
            <Threats sets={sets} level={level} team={team} />
            <Text className="px-4 text-caption text-ink-subtle">
              Worst case for you: their stronger ability, the highest IVs their
              trainers use, Intimidate applied. From full HP, no stat changes or
              critical hits. Tap a set for the full matchup.
            </Text>
          </View>
        ) : (
          <Text className="px-4 pb-4 text-callout text-ink-muted">
            Save a team first, on the Teams tab or with “New team” above.
          </Text>
        ))}
    </Card>
  );
}

function Threats({
  sets,
  level,
  team,
}: {
  sets: { id: number; possibleIvs: number[] }[];
  level: number;
  team: Team;
}) {
  const db = useDb();
  const chart = useMemo(() => getTypeChart(db), [db]);
  // The most dangerous IV each set can have (random IVs: assume 31).
  const ivOf = useMemo(
    () =>
      new Map(
        sets.map((s) => [
          s.id,
          s.possibleIvs.length > 0 ? Math.max(...s.possibleIvs) : 31,
        ]),
      ),
    [sets],
  );
  const foes = useMemo(
    () =>
      getSetCombatants(
        db,
        sets.map((s) => s.id),
        level,
        (id) => ivOf.get(id) ?? 31,
      ),
    [db, sets, level, ivOf],
  );
  const members = getTeamCombatants(db, team);
  const foeList: ThreatFoe[] = [...foes].map(([setId, c]) => ({
    setId,
    battler: c.battler,
    moves: c.moves,
    abilities: c.abilities.map((a) => a.key),
  }));

  return (
    <View>
      {members.map((member, slot) =>
        member ? (
          <View key={slot}>
            {slot > 0 && <Divider className="ml-4" />}
            <MemberThreats
              member={member}
              threats={assessThreats(member, foeList, chart)}
              foes={foes}
              total={foeList.length}
              level={level}
              ivOf={ivOf}
              teamId={team.id}
            />
          </View>
        ) : null,
      )}
    </View>
  );
}

function MemberThreats({
  member,
  threats,
  foes,
  total,
  level,
  ivOf,
  teamId,
}: {
  member: Combatant;
  threats: Threat[];
  foes: Map<number, Combatant>;
  total: number;
  level: number;
  ivOf: Map<number, number>;
  teamId: string;
}) {
  const [all, setAll] = useState(false);
  const deadly = threats.filter((t) => t.level === "deadly").length;
  const dangerous = threats.filter((t) => t.level === "dangerous").length;
  const worrying = threats.filter((t) => t.level !== "fine");
  const shown = all ? worrying : worrying.slice(0, SHOWN);

  return (
    <View className="gap-2 px-4 py-3">
      <View className="flex-row items-center gap-3">
        <Sprite id={member.battler.pokemonId} size={48} game="emerald" />
        <View className="flex-1">
          <Text className="text-headline font-bold text-ink">
            {member.name}
          </Text>
          <Text className="text-caption text-ink-muted" style={TABULAR}>
            {deadly + dangerous === 0
              ? `None of the ${total} sets threatens it`
              : [
                  deadly > 0 && `${deadly} can knock it out first`,
                  dangerous > 0 && `${dangerous} dangerous`,
                ]
                  .filter(Boolean)
                  .join(" · ") + ` (of ${total})`}
          </Text>
        </View>
      </View>
      {shown.map((t) => {
        const foe = foes.get(t.setId)!;
        return (
          <Pressable
            key={t.setId}
            onPress={() =>
              router.push({
                pathname: "/matchup",
                params: {
                  set: t.setId,
                  level,
                  iv: ivOf.get(t.setId) ?? 31,
                  team: teamId,
                },
              })
            }
            className="flex-row items-center gap-3 rounded-tile bg-sunken py-1.5 pl-1 pr-3 active:opacity-60"
          >
            <Sprite id={foe.battler.pokemonId} size={44} game="emerald" />
            <View className="flex-1">
              <Text
                className="text-callout font-semibold text-ink"
                numberOfLines={1}
              >
                {foe.name}
                <Text className="font-normal text-ink-subtle" style={TABULAR}>
                  {"  "}Set {t.setId}
                </Text>
              </Text>
              <Text className="text-caption text-ink-muted" numberOfLines={1}>
                {t.theirBest
                  ? `${t.theirBest.move} ${Math.floor(t.theirBest.minShare * 100)}–${Math.floor(t.theirBest.maxShare * 100)}%`
                  : ""}
                {t.ohkoMove
                  ? `${t.theirBest ? " · " : ""}${t.ohkoMove} (one-hit KO)`
                  : ""}
              </Text>
            </View>
            <View className="items-end gap-0.5">
              <View
                className={`rounded-md px-1.5 py-0.5 ${
                  t.level === "deadly" ? "bg-red-500/20" : "bg-amber-500/20"
                }`}
              >
                <Text
                  className={`text-micro font-semibold ${
                    t.level === "deadly"
                      ? "text-red-600 dark:text-red-400"
                      : "text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {t.level === "deadly" ? "Deadly" : "Dangerous"}
                </Text>
              </View>
              <Text className="text-micro text-ink-subtle">
                {t.order === "they"
                  ? "Faster"
                  : t.order === "tie"
                    ? "Speed tie"
                    : "Slower"}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {worrying.length > SHOWN && (
        <Pressable
          onPress={() => setAll((a) => !a)}
          role="button"
          className="h-9 items-center justify-center active:opacity-60"
        >
          <Text className="text-callout font-semibold text-accent">
            {all ? "Show fewer" : `Show all ${worrying.length}`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
