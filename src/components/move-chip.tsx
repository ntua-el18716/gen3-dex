import { Text, View } from "react-native";

import type { PokemonType } from "@/db/schema";

import { TypeDot } from "./type-badge";

/** A move's name with its type as a small coloured dot. */
export function MoveChip({
  name,
  type,
  wide = false,
}: {
  name: string;
  type?: PokemonType;
  /** Fill half the row (for 2×2 move grids). */
  wide?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-full bg-sunken py-1 pl-1 pr-2.5 ${
        wide ? "w-[48.5%]" : ""
      }`}
    >
      {type ? <TypeDot type={type} size={18} /> : <View className="w-1" />}
      <Text
        className={`font-bold text-ink ${wide ? "flex-1 text-[13px]" : "text-[11px]"}`}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}
