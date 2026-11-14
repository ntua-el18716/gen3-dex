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
 * The same hue at the strength of a type colour: sprite colours are often
 * pale or dull, and a tint made from them would barely show. Greys stay grey.
 */
export function vivid([r, g, b]: Rgb): Rgb {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  let l = (max + min) / 2;
  let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.12) return [r, g, b];
  const h =
    max === r / 255
      ? ((g - b) / 255 / d + 6) % 6
      : max === g / 255
        ? (b - r) / 255 / d + 2
        : (r - g) / 255 / d + 4;
  s = Math.max(s, 0.65);
  l = Math.min(Math.max(l, 0.52), 0.62);
  // HSL back to RGB.
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 1
      ? [c, x, 0]
      : h < 2
        ? [x, c, 0]
        : h < 3
          ? [0, c, x]
          : h < 4
            ? [0, x, c]
            : h < 5
              ? [x, 0, c]
              : [c, 0, x];
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
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
