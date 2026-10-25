import { SectionList, Text, View } from "react-native";

import { TypeBadge } from "@/components/type-badge";
import type { LearnsetMove, LearnsetSection } from "@/db/queries";
import type { Game, LearnMethod } from "@/db/schema";
import { damageClass, type DamageClass } from "@/lib/damage-class";
import { GAME_INFO } from "@/lib/games";

const SECTION_TITLES: Record<LearnMethod, string> = {
  level: "Level up",
  machine: "TM / HM",
  tutor: "Move tutor",
  egg: "Egg moves",
};

const CLASS_STYLES: Record<DamageClass, { label: string; className: string }> =
  {
    physical: { label: "Phys", className: "bg-orange-500/15 text-orange-500" },
    special: { label: "Spec", className: "bg-blue-500/15 text-blue-500" },
    status: { label: "Status", className: "bg-sunken text-ink-muted" },
  };

/** The Pokémon's moves in the current game, one section per learn method. */
export function MovesPage({
  sections,
  game,
}: {
  sections: LearnsetSection[];
  game: Game;
}) {
  return (
    <SectionList
      sections={sections}
      keyExtractor={(m) => `${m.method}-${m.moveId}-${m.level}`}
      stickySectionHeadersEnabled
      contentContainerClassName="pb-12"
      ListHeaderComponent={
        <Text className="px-4 pt-4 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Moves in {GAME_INFO[game].name}
        </Text>
      }
      renderSectionHeader={({ section }) => (
        <View className="flex-row items-center bg-canvas px-4 pb-2 pt-4">
          <Text className="flex-1 text-lg font-bold text-ink">
            {SECTION_TITLES[section.method]}{" "}
            <Text className="text-ink-subtle">{section.data.length}</Text>
          </Text>
          <Text className="w-10 text-right text-xs text-ink-subtle">Pow</Text>
          <Text className="w-10 text-right text-xs text-ink-subtle">Acc</Text>
          <Text className="w-8 text-right text-xs text-ink-subtle">PP</Text>
        </View>
      )}
      renderItem={({ item, index, section }) => (
        <MoveRow
          move={item}
          first={index === 0}
          last={index === section.data.length - 1}
        />
      )}
      ListEmptyComponent={
        <Text className="p-8 text-center text-ink-muted">
          No moves recorded for this game.
        </Text>
      }
    />
  );
}

/** Rows of one section form a single rounded card. */
function MoveRow({
  move,
  first,
  last,
}: {
  move: LearnsetMove;
  first: boolean;
  last: boolean;
}) {
  const label =
    move.method === "level"
      ? `Lv ${move.level}`
      : move.method === "machine"
        ? move.machine
        : null;
  const cls = CLASS_STYLES[damageClass(move)];
  return (
    <View
      className={`mx-4 flex-row items-center gap-2 border-x border-line bg-surface px-3 py-2.5 ${
        first ? "rounded-t-2xl border-t" : ""
      } ${last ? "rounded-b-2xl border-b" : "border-b border-b-line/50"}`}
    >
      {label !== null && (
        <Text className="w-12 text-xs font-semibold text-ink-subtle">
          {label}
        </Text>
      )}
      <View className="flex-1 gap-1">
        <Text className="text-sm font-bold text-ink">{move.name}</Text>
        <View className="flex-row items-center gap-1.5">
          <TypeBadge type={move.type} small />
          <Text
            className={`overflow-hidden rounded-full px-2 text-[10px] font-bold ${cls.className}`}
          >
            {cls.label}
          </Text>
        </View>
      </View>
      <Text className="w-10 text-right text-sm text-ink-muted">
        {/* 0 = status move, 1 = power is calculated (e.g. Low Kick). */}
        {move.power === 0 ? "—" : move.power === 1 ? "var" : move.power}
      </Text>
      <Text className="w-10 text-right text-sm text-ink-muted">
        {/* 0 = never misses. */}
        {move.accuracy === 0 ? "—" : move.accuracy}
      </Text>
      <Text className="w-8 text-right text-sm text-ink-muted">{move.pp}</Text>
    </View>
  );
}
