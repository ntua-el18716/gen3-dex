import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { PokemonType } from "@/db/schema";

import { TypeDot } from "./type-badge";

/** A move's name with its type as a small coloured dot. */
export function MoveChip({
  id,
  name,
  type,
  wide = false,
}: {
  /** The move's id: the chip then opens the move's page. */
  id?: number;
  name: string;
  type?: PokemonType;
  /** Fill half the row (for 2×2 move grids). */
  wide?: boolean;
}) {
  const className = `flex-row items-center gap-1.5 rounded-lg bg-sunken py-1 pl-1 pr-2.5 ${
    wide ? "w-[48.5%]" : ""
  }`;
  const content = (
    <>
      {type ? <TypeDot type={type} size={18} /> : <View className="w-1.5" />}
      <Text
        className={`font-semibold text-ink ${wide ? "flex-1 text-callout" : "text-caption"}`}
        numberOfLines={1}
      >
        {name}
      </Text>
    </>
  );
  if (id === undefined) return <View className={className}>{content}</View>;
  return (
    <Link href={{ pathname: "/move/[id]", params: { id } }} asChild>
      <Pressable className={`${className} active:opacity-60`}>
        {content}
      </Pressable>
    </Link>
  );
}
