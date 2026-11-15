import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View } from "react-native";

import { Sprite } from "@/components/sprite";
import { spriteColors } from "@/generated/sprite-colors";
import { purposeLabel } from "@/lib/team-labels";
import { MAX_TEAM_SIZE, teamIssues, type Team } from "@/lib/teams";
import { hexToRgb, mix, vivid } from "@/theme/colors";
import { useColors, usePalette } from "@/theme/theme";

import { PurposeIcon } from "./purpose-icon";

const SLOT = 52;
const SPRITE = 64;

/**
 * A team in a list. No card around it: the Pokémon are the picture, each
 * on a disc of its own colour and a little bigger than the disc, with the
 * team's name and purpose as a caption above. Empty slots are small dots.
 */
export function TeamCard({ team }: { team: Team }) {
  const colors = useColors();
  const { canvas } = usePalette();
  const blocked = team.members.length > 0 && teamIssues(team).length > 0;
  return (
    <Link href={{ pathname: "/teams/[id]", params: { id: team.id } }} asChild>
      <Pressable className="gap-3 py-3 active:opacity-60">
        <View className="flex-row items-center gap-2.5 px-1">
          <PurposeIcon purpose={team.purpose} game={team.game} size={28} />
          <View className="flex-1">
            <Text
              className="text-headline font-semibold text-ink"
              numberOfLines={1}
            >
              {team.name || "Untitled team"}
            </Text>
            <Text className="text-caption text-ink-muted" numberOfLines={1}>
              {purposeLabel(team)}
              {blocked ? " · can’t enter yet" : ""}
            </Text>
          </View>
          <SymbolView
            name={{
              ios: "chevron.right",
              android: "chevron_right",
              web: "chevron_right",
            }}
            tintColor={colors["ink-subtle"]}
            size={20}
          />
        </View>
        {team.members.length === 0 && (
          <Text className="px-1 text-callout text-ink-subtle">
            No Pokémon yet. Tap to add some.
          </Text>
        )}
        <View
          className={`flex-row justify-between px-1 ${
            team.members.length === 0 ? "hidden" : ""
          }`}
        >
          {Array.from({ length: MAX_TEAM_SIZE }, (_, i) => {
            const member = team.members[i];
            const own = member && spriteColors[member.pokemonId];
            return (
              <View
                key={i}
                className="items-center justify-center"
                style={{ width: SLOT, height: SLOT }}
              >
                {member ? (
                  <>
                    <View
                      className="absolute inset-0 rounded-full"
                      style={{
                        backgroundColor: own
                          ? mix(vivid(hexToRgb(own[0])), canvas, 0.28)
                          : colors.sunken,
                      }}
                    />
                    {/* Bigger than its disc, so it stands out of it. */}
                    <View style={{ margin: (SLOT - SPRITE) / 2 }}>
                      <Sprite
                        id={member.pokemonId}
                        size={SPRITE}
                        game={team.game}
                      />
                    </View>
                  </>
                ) : (
                  <View className="h-2 w-2 rounded-full bg-line" />
                )}
              </View>
            );
          })}
        </View>
      </Pressable>
    </Link>
  );
}
