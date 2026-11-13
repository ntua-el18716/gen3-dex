import type { Game, PokemonType } from "@/db/schema";

import typeColors from "./type-colors.json";

export type Rgb = readonly [number, number, number];

/** A type's colour as a hex string ("???" uses the "mystery" entry). */
export function typeColor(type: PokemonType): string {
  return typeColors[type === "???" ? "mystery" : type];
}

/**
 * Types whose colour is too light for white text (contrast below ~3:1);
 * their chips use dark text instead.
 */
export const LIGHT_TYPES: ReadonlySet<PokemonType> = new Set([
  "electric",
  "ice",
  "steel",
  "ground",
]);

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * `amount` of colour `a` over colour `b` (0 = all b, 1 = all a), as an rgb()
 * string. Used for type tints that must be opaque, e.g. gradient stops.
 */
export function mix(a: Rgb, b: Rgb, amount: number): string {
  const c = a.map((v, i) => Math.round(v * amount + b[i]! * (1 - amount)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * The selected game's colour is the app's accent. Dark mode uses lighter
 * versions (like palette.json's own accent), with dark text on top.
 */
export const GAME_ACCENTS: Record<"light" | "dark", Record<Game, Rgb>> = {
  light: {
    ruby: [192, 57, 43],
    sapphire: [37, 99, 235],
    emerald: [5, 150, 105],
    firered: [234, 88, 12],
    leafgreen: [77, 124, 15],
  },
  dark: {
    ruby: [248, 113, 113],
    sapphire: [96, 165, 250],
    emerald: [52, 211, 153],
    firered: [251, 146, 60],
    leafgreen: [163, 230, 53],
  },
};
