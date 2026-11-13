import { Text, View } from "react-native";
import { SvgXml } from "react-native-svg";

import type { PokemonType } from "@/db/schema";
import { typeIcons } from "@/generated/type-icons";
import { LIGHT_TYPES, typeColor } from "@/theme/colors";

/** A faint wash of the type's colour, for backgrounds behind sprites. */
export const TYPE_TINT: Record<PokemonType, string> = {
  normal: "bg-type-normal/20",
  fighting: "bg-type-fighting/20",
  flying: "bg-type-flying/20",
  poison: "bg-type-poison/20",
  ground: "bg-type-ground/20",
  rock: "bg-type-rock/20",
  bug: "bg-type-bug/20",
  ghost: "bg-type-ghost/20",
  steel: "bg-type-steel/20",
  "???": "bg-type-mystery/20",
  fire: "bg-type-fire/20",
  water: "bg-type-water/20",
  grass: "bg-type-grass/20",
  electric: "bg-type-electric/20",
  psychic: "bg-type-psychic/20",
  ice: "bg-type-ice/20",
  dragon: "bg-type-dragon/20",
  dark: "bg-type-dark/20",
};

/** Glyph colour on the type's colour: white, or dark on light types. */
function glyphColor(type: PokemonType) {
  return LIGHT_TYPES.has(type) ? "#1F2937" : "#FFFFFF";
}

/** The type's icon glyph, drawn in `color`. */
export function TypeIcon({
  type,
  size,
  color = glyphColor(type),
}: {
  type: PokemonType;
  size: number;
  color?: string;
}) {
  const xml = typeIcons[type];
  if (!xml) return <View style={{ width: size, height: size }} />;
  return <SvgXml xml={xml} width={size} height={size} color={color} />;
}

/**
 * A type label. Every chip has the same width, with the icon pinned left and
 * the name centred in the rest, so chips line up whatever the name's length.
 */
export function TypeBadge({
  type,
  small = false,
}: {
  type: PokemonType;
  /** Narrower and smaller text, for lists and cards. */
  small?: boolean;
}) {
  const icon = small ? 16 : 18;
  return (
    <View
      className={`flex-row items-center rounded-full ${small ? "w-[84px]" : "w-[96px]"}`}
      style={{ backgroundColor: typeColor(type), padding: 2 }}
    >
      <View
        className={`items-center justify-center rounded-full ${LIGHT_TYPES.has(type) ? "bg-black/10" : "bg-white/25"}`}
        style={{ width: icon + 2, height: icon + 2, padding: 2 }}
      >
        <TypeIcon type={type} size={icon - 2} />
      </View>
      <Text
        className={`flex-1 pr-1 text-center font-extrabold uppercase tracking-wide ${small ? "text-[10px]" : "text-[11px]"}`}
        style={{ color: glyphColor(type) }}
        numberOfLines={1}
      >
        {type}
      </Text>
    </View>
  );
}

/** Just the icon in a circle of the type's colour, where space is tight. */
export function TypeDot({
  type,
  size = 26,
}: {
  type: PokemonType;
  size?: number;
}) {
  return (
    <View
      accessibilityLabel={type}
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: typeColor(type) }}
    >
      <TypeIcon type={type} size={Math.round(size * 0.6)} />
    </View>
  );
}
