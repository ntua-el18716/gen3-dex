import { LinearGradient } from "expo-linear-gradient";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { PokeballMark } from "@/components/pokeball-mark";
import { useTypeGradient } from "@/components/pokemon-row";
import { Sprite } from "@/components/sprite";
import { PurposeIcon } from "@/components/teams/purpose-icon";
import { TypeDot } from "@/components/type-badge";
import {
  Card,
  Divider,
  Field,
  Label,
  Pills,
  SectionTitle,
  Segmented,
  TABULAR,
  Tag,
} from "@/components/ui";
import { useDb } from "@/db";
import {
  getSetCombatant,
  getTeamCombatants,
  getTypeChart,
  type Combatant,
} from "@/db/damage-queries";
import {
  calculateDamage,
  summarize,
  type DamageOptions,
  type TypeMatchup,
  type Weather,
} from "@/lib/damage";
import {
  effectivenessLabel,
  koText,
  noDamageText,
  shareRange,
} from "@/lib/damage-labels";
import { useTeams } from "@/state/teams";

/**
 * A Battle Frontier set against one of your teams: for each of your
 * Pokémon, what its moves do to the opponent and what the opponent's do to
 * it, with the game's exact damage formula (lib/damage.ts).
 *
 * Opened from a set card with ?set=<id>&level=<n>&iv=<n>.
 */
export default function MatchupScreen() {
  const params = useLocalSearchParams<{
    set: string;
    level: string;
    iv: string;
    team?: string;
  }>();
  const db = useDb();
  const { teams, createTeam } = useTeams();
  const level = Number(params.level) || 50;
  const iv = Number(params.iv) || 0;
  const setId = Number(params.set);

  const chart = useMemo(() => getTypeChart(db), [db]);
  const foe = useMemo(
    () => getSetCombatant(db, setId, level, iv),
    [db, setId, level, iv],
  );
  const usable = teams.filter((t) => t.members.length > 0);
  const [teamId, setTeamId] = useState(params.team ?? usable[0]?.id);
  const team = usable.find((t) => t.id === teamId) ?? usable[0];
  // (The React Compiler caches this; a manual useMemo can't track `team`.)
  const mine = team ? getTeamCombatants(db, team) : [];
  const [abilityKey, setAbilityKey] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather>("clear");
  const [critical, setCritical] = useState(false);

  if (!foe) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Matchup" }} />
        <Text className="text-body text-ink-muted">No such set.</Text>
      </View>
    );
  }
  // Frontier Pokémon have either of their abilities; the user says which.
  const opponent: Combatant = {
    ...foe,
    battler: { ...foe.battler, ability: abilityKey ?? foe.battler.ability },
  };
  const options: DamageOptions = { weather, critical, frontier: true };

  return (
    <ScrollView contentContainerClassName="gap-6 px-4 pb-12 pt-2">
      <Stack.Screen options={{ title: "Matchup" }} />

      <FoeCard foe={opponent} setId={setId} iv={iv} />

      <Card className="gap-5 p-4">
        {foe.abilities.length > 1 && (
          <Field
            label={`${foe.name}'s ability`}
            note="Frontier Pokémon get either one at random."
          >
            <Segmented
              options={foe.abilities.map((a) => ({
                value: a.key,
                label: a.name,
              }))}
              value={opponent.battler.ability ?? ""}
              onChange={setAbilityKey}
              fill
            />
          </Field>
        )}
        <Field label="Weather">
          <Segmented
            options={[
              { value: "clear", label: "Clear" },
              { value: "sun", label: "Sun" },
              { value: "rain", label: "Rain" },
            ]}
            value={weather}
            onChange={setWeather}
            fill
          />
        </Field>
        <Field label="Hits">
          <Segmented
            options={[
              { value: 0, label: "Normal" },
              { value: 1, label: "Critical" },
            ]}
            value={critical ? 1 : 0}
            onChange={(v) => setCritical(v === 1)}
            fill
          />
        </Field>
      </Card>

      {usable.length === 0 ? (
        <View className="items-center gap-3 px-4 py-6">
          <Text className="text-center text-body text-ink-muted">
            Save a team to see how each of your Pokémon fares against this set.
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/teams/[id]",
                params: { id: createTeam("emerald", "tower") },
              })
            }
            role="button"
            className="h-11 justify-center rounded-full bg-accent px-5 active:opacity-60"
          >
            <Text className="text-body font-semibold text-on-accent">
              Create a team
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-3">
          <SectionTitle>Your team</SectionTitle>
          {usable.length > 1 && (
            <Pills
              options={usable.map((t) => ({
                value: t.id,
                label: t.name || "Untitled team",
                left: (
                  <PurposeIcon purpose={t.purpose} game={t.game} size={32} />
                ),
              }))}
              value={team?.id}
              onChange={setTeamId}
            />
          )}
          {team &&
            mine.map((member, slot) =>
              member ? (
                <MemberMatchup
                  key={slot}
                  teamId={team.id}
                  slot={slot}
                  member={member}
                  foe={opponent}
                  chart={chart}
                  options={options}
                />
              ) : null,
            )}
          <Text className="px-1 text-caption text-ink-subtle">
            From full HP, with no status conditions, stat changes or screens.
            The game rolls 85–100% of the damage each hit, hence the ranges.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/** The opponent, tinted in its own colours. */
function FoeCard({
  foe,
  setId,
  iv,
}: {
  foe: Combatant;
  setId: number;
  iv: number;
}) {
  const { battler } = foe;
  const gradient = useTypeGradient({
    id: battler.pokemonId,
    type1: battler.type1,
    type2: battler.type2,
  });
  return (
    <View className="overflow-hidden rounded-card">
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={{ position: "absolute", inset: 0 }}
      />
      <PokeballMark
        size={130}
        style={{ position: "absolute", left: -24, top: -24 }}
      />
      <View className="flex-row items-center gap-3 p-4">
        <Sprite id={battler.pokemonId} size={80} game="emerald" />
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="flex-shrink text-title font-bold tracking-tight text-ink">
              {foe.name}
            </Text>
            <View className="ml-auto flex-row gap-1">
              <TypeDot type={battler.type1} size={22} />
              {battler.type2 && <TypeDot type={battler.type2} size={22} />}
            </View>
          </View>
          <Text className="text-callout text-ink-muted" style={TABULAR}>
            Set {setId} · Lv {battler.level} · every IV {iv}
          </Text>
          <Text className="text-callout text-ink-muted">
            {foe.itemName ? (
              <Text className="font-semibold text-ink">{foe.itemName}</Text>
            ) : (
              "No item"
            )}
            {"  "}
            <Text style={TABULAR}>{battler.stats.hp} HP</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

/** One of your Pokémon against the opponent, both ways. */
function MemberMatchup({
  teamId,
  slot,
  member,
  foe,
  chart,
  options,
}: {
  teamId: string;
  slot: number;
  member: Combatant;
  foe: Combatant;
  chart: TypeMatchup[];
  options: DamageOptions;
}) {
  const mySpeed = member.battler.stats.speed;
  const theirSpeed = foe.battler.stats.speed;
  return (
    <Card>
      <Link
        href={{
          pathname: "/teams/[id]/member/[slot]",
          params: { id: teamId, slot },
        }}
        asChild
      >
        <Pressable className="flex-row items-center gap-3 px-4 pb-2 pt-3 active:opacity-60">
          <Sprite id={member.battler.pokemonId} size={56} game="emerald" />
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Text
                className="flex-shrink text-headline font-bold text-ink"
                numberOfLines={1}
              >
                {member.name}
              </Text>
              <Text
                className="text-caption font-medium text-ink-muted"
                style={TABULAR}
              >
                Lv {member.battler.level}
              </Text>
            </View>
            <Text className="text-callout text-ink-muted" style={TABULAR}>
              {mySpeed === theirSpeed
                ? "Speed tie"
                : mySpeed > theirSpeed
                  ? "Moves first"
                  : "Moves second"}
              {`  ·  ${mySpeed} vs ${theirSpeed} Speed`}
            </Text>
          </View>
        </Pressable>
      </Link>
      <MoveList
        title={`${member.name} attacks`}
        attacker={member}
        defender={foe}
        chart={chart}
        options={options}
        tone="good"
      />
      <Divider className="ml-4" />
      <MoveList
        title={`${foe.name} attacks`}
        attacker={foe}
        defender={member}
        chart={chart}
        options={options}
        tone="bad"
      />
    </Card>
  );
}

function MoveList({
  title,
  attacker,
  defender,
  chart,
  options,
  tone,
}: {
  title: string;
  attacker: Combatant;
  defender: Combatant;
  chart: TypeMatchup[];
  options: DamageOptions;
  /** Damage you deal is good news, damage you take is bad. */
  tone: "good" | "bad";
}) {
  return (
    <View className="gap-3 px-4 py-3">
      <Label>{title}</Label>
      {attacker.moves.length === 0 && (
        <Text className="text-callout text-ink-subtle">No moves chosen.</Text>
      )}
      {attacker.moves.map((move) => {
        const result = calculateDamage(
          attacker.battler,
          defender.battler,
          move,
          chart,
          options,
        );
        const summary =
          result.kind === "damage"
            ? summarize(result, defender.battler.stats.hp)
            : null;
        const effective =
          result.kind === "damage"
            ? effectivenessLabel(result.effectiveness)
            : null;
        return (
          <View key={move.id} className="gap-1.5">
            <View className="flex-row items-center gap-2">
              <TypeDot type={move.type} size={20} />
              <Text
                className="flex-shrink text-body font-semibold text-ink"
                numberOfLines={1}
              >
                {move.name}
              </Text>
              {effective && <Tag>{effective}</Tag>}
              <Text
                className={`ml-auto text-body font-bold ${
                  summary ? "text-ink" : "text-ink-subtle"
                }`}
                style={TABULAR}
              >
                {summary ? shareRange(summary) : "—"}
              </Text>
            </View>
            {summary && (
              <View className="h-1.5 overflow-hidden rounded-full bg-sunken">
                {/* Light up to the best roll, solid up to the worst. */}
                <View
                  className={`absolute bottom-0 left-0 top-0 rounded-full opacity-40 ${
                    tone === "good" ? "bg-accent" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(1, summary.maxShare) * 100}%` }}
                />
                <View
                  className={`absolute bottom-0 left-0 top-0 rounded-full ${
                    tone === "good" ? "bg-accent" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(1, summary.minShare) * 100}%` }}
                />
              </View>
            )}
            <Text className="text-caption text-ink-muted">
              {summary
                ? koText(summary)
                : noDamageText(
                    result as Exclude<typeof result, { kind: "damage" }>,
                  )}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
