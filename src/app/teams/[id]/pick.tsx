import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { dexNumber } from "@/components/pokemon-row";
import { Sprite } from "@/components/sprite";
import { TypeDot } from "@/components/type-badge";
import { Divider, SearchField, Segmented, TABULAR } from "@/components/ui";
import { useDb } from "@/db";
import {
  getTeachableMoves,
  listHoldItems,
  listMoves,
  listNatures,
  listSpecies,
} from "@/db/team-queries";
import { natureEffect } from "@/lib/team-labels";
import {
  defaultLevel,
  MAX_TEAM_SIZE,
  newMember,
  withMove,
  withSpecies,
  type Team,
  type TeamMember,
} from "@/lib/teams";
import { useTeam, useTeams } from "@/state/teams";

const FIELDS = ["species", "move", "item", "nature"] as const;
type PickField = (typeof FIELDS)[number];

const TITLES: Record<PickField, string> = {
  species: "Choose a Pokémon",
  move: "Choose a move",
  item: "Choose a held item",
  nature: "Choose a nature",
};

/** One row of a list of choices. */
type Option = {
  key: string;
  title: string;
  /** Second line. */
  detail?: string;
  /** Right-aligned note. */
  aside?: string;
  left?: ReactNode;
  /** What choosing it does to the team. */
  apply: (team: Team) => Team;
};

/**
 * The list a team's editor opens to choose a Pokémon, move, item or nature.
 * Choosing writes straight to the team and closes the list. `slot` is the
 * member being edited, or "new" to add one; `index` is the move slot.
 */
export default function PickScreen() {
  const params = useLocalSearchParams<{
    id: string;
    field: string;
    slot: string;
    index?: string;
  }>();
  const field = FIELDS.find((f) => f === params.field);
  const team = useTeam(params.id);
  if (!team || !field) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "Choose" }} />
        <Text className="text-body text-ink-muted">
          Nothing to choose here.
        </Text>
      </View>
    );
  }
  return (
    <Picker
      team={team}
      field={field}
      slot={params.slot === "new" ? "new" : Number(params.slot)}
      index={Number(params.index ?? 0)}
    />
  );
}

function Picker({
  team,
  field,
  slot,
  index,
}: {
  team: Team;
  field: PickField;
  slot: number | "new";
  index: number;
}) {
  const db = useDb();
  const { updateTeam } = useTeams();
  const [query, setQuery] = useState("");
  const [allMoves, setAllMoves] = useState(false);
  const member = slot === "new" ? undefined : team.members[slot];

  const options = useMemo((): Option[] => {
    /** Changes the member being edited. */
    const edit =
      (change: (member: TeamMember) => TeamMember) =>
      (t: Team): Team => ({
        ...t,
        members: t.members.map((m, i) => (i === slot ? change(m) : m)),
      });
    switch (field) {
      case "species":
        return listSpecies(db).map((p) => ({
          key: String(p.id),
          title: p.name,
          aside: dexNumber(p.id),
          left: <Sprite id={p.id} size={40} game={team.game} />,
          apply:
            slot === "new"
              ? (t) =>
                  t.members.length >= MAX_TEAM_SIZE
                    ? t
                    : {
                        ...t,
                        members: [
                          ...t.members,
                          newMember(p.id, p.ability1Id, defaultLevel(t)),
                        ],
                      }
              : edit((m) => withSpecies(m, p.id, p.ability1Id)),
        }));
      case "move": {
        if (!member) return [];
        const moves = allMoves
          ? listMoves(db)
          : getTeachableMoves(db, member.pokemonId, team.game);
        return moves.map((mv) => ({
          key: String(mv.id),
          title: mv.name,
          detail: [
            mv.how,
            // 0 = status move, 1 = power is calculated; 0 accuracy = never misses.
            mv.power > 1
              ? `Power ${mv.power}`
              : mv.power === 1
                ? "Power varies"
                : "Status",
            mv.accuracy > 0 ? `${mv.accuracy}%` : null,
            `${mv.pp} PP`,
          ]
            .filter(Boolean)
            .join(" · "),
          left: <TypeDot type={mv.type} size={26} />,
          apply: edit((m) => withMove(m, index, mv.id)),
        }));
      }
      case "item":
        return [
          {
            key: "none",
            title: "No item",
            apply: edit((m) => ({ ...m, itemId: null })),
          },
          ...listHoldItems(db).map((it) => ({
            key: String(it.id),
            title: it.name,
            detail: it.description,
            apply: edit((m: TeamMember) => ({ ...m, itemId: it.id })),
          })),
        ];
      case "nature":
        return listNatures(db).map((n) => ({
          key: String(n.id),
          title: n.name,
          aside: natureEffect(n),
          apply: edit((m) => ({ ...m, natureId: n.id })),
        }));
    }
  }, [db, field, slot, index, member, team.game, allMoves]);

  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter(
        (o) => o.title.toLowerCase().includes(q) || o.aside === `#${q}`,
      )
    : options;

  const choose = (option: Option) => {
    updateTeam(team.id, option.apply);
    if (slot === "new" && team.members.length < MAX_TEAM_SIZE) {
      // Straight on to the new member's editor, to give it moves.
      router.replace({
        pathname: "/teams/[id]/member/[slot]",
        params: { id: team.id, slot: team.members.length },
      });
    } else router.back();
  };

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ title: TITLES[field] }} />
      <View className="gap-3 px-4 pb-3 pt-2">
        <SearchField value={query} onChange={setQuery} placeholder="Search" />
        {field === "move" && (
          <Segmented
            options={[
              { value: 0, label: "Moves it learns" },
              { value: 1, label: "All moves" },
            ]}
            value={allMoves ? 1 : 0}
            onChange={(v) => setAllMoves(v === 1)}
            fill
          />
        )}
      </View>
      <FlatList
        data={shown}
        keyExtractor={(o) => o.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="pb-10"
        ItemSeparatorComponent={() => <Divider className="ml-4" />}
        renderItem={({ item: o }) => (
          <Pressable
            onPress={() => choose(o)}
            className="min-h-14 flex-row items-center gap-3 px-4 py-2 active:bg-sunken"
          >
            {o.left}
            <View className="flex-1 gap-0.5">
              <Text className="text-body font-semibold text-ink">
                {o.title}
              </Text>
              {o.detail && (
                <Text className="text-caption text-ink-muted">{o.detail}</Text>
              )}
            </View>
            {o.aside && (
              <Text className="text-callout text-ink-muted" style={TABULAR}>
                {o.aside}
              </Text>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="p-8 text-center text-body text-ink-muted">
            {field === "move" && !allMoves && !q
              ? "No moves recorded for this Pokémon in this game. Try “All moves”."
              : `Nothing matches “${query}”.`}
          </Text>
        }
      />
    </View>
  );
}
