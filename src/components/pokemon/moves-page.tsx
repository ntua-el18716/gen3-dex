import { SectionList, Text, View } from "react-native";

import { TypeBadge } from "@/components/type-badge";
import type { LearnsetMove, LearnsetSection } from "@/db/queries";
import type { Game, LearnMethod } from "@/db/schema";
import { damageClass } from "@/lib/damage-class";
import { GAME_INFO } from "@/lib/games";

const SECTION_TITLES: Record<LearnMethod, string> = {
  level: "Level up",
  machine: "TM / HM",
  tutor: "Move tutor",
  egg: "Egg moves",
};

const CLASS_LABELS = { physical: "Phys", special: "Spec", status: "Status" };

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
        <View className="flex-row px-4 pt-3">
          <Text className="flex-1 text-xs text-neutral-500">
            Moves in {GAME_INFO[game].name}
          </Text>
          <Text className="w-10 text-right text-xs text-neutral-500">Pow</Text>
          <Text className="w-10 text-right text-xs text-neutral-500">Acc</Text>
          <Text className="w-8 text-right text-xs text-neutral-500">PP</Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text className="bg-neutral-50 px-4 py-2 font-bold text-neutral-900">
          {SECTION_TITLES[section.method]} ({section.data.length})
        </Text>
      )}
      renderItem={({ item }) => <MoveRow move={item} />}
      ListEmptyComponent={
        <Text className="p-8 text-center text-neutral-500">
          No moves recorded for this game.
        </Text>
      }
    />
  );
}

function MoveRow({ move }: { move: LearnsetMove }) {
  const label =
    move.method === "level"
      ? `Lv ${move.level}`
      : move.method === "machine"
        ? move.machine
        : null;
  return (
    <View className="flex-row items-center gap-2 border-b border-neutral-100 px-4 py-2">
      {label !== null && (
        <Text className="w-11 text-xs text-neutral-500">{label}</Text>
      )}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-neutral-900">
          {move.name}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-2">
          <TypeBadge type={move.type} small />
          <Text className="text-xs text-neutral-500">
            {CLASS_LABELS[damageClass(move)]}
          </Text>
        </View>
      </View>
      <Text className="w-10 text-right text-sm text-neutral-700">
        {/* 0 = status move, 1 = power is calculated (e.g. Low Kick). */}
        {move.power === 0 ? "—" : move.power === 1 ? "var" : move.power}
      </Text>
      <Text className="w-10 text-right text-sm text-neutral-700">
        {/* 0 = never misses. */}
        {move.accuracy === 0 ? "—" : move.accuracy}
      </Text>
      <Text className="w-8 text-right text-sm text-neutral-700">{move.pp}</Text>
    </View>
  );
}
