import {
  TOWN_MAP_AREAS,
  TOWN_MAPS,
  type TownMapId,
} from "@/generated/town-map";
import type { Region } from "@/lib/league";

export { TOWN_MAPS, type TownMapId };

/** An area on the Town Map, in tiles of its picture. */
export type TownMapArea = {
  /** "region:MAPSEC_…", as location.map_section within its region. */
  key: string;
  name: string;
  map: TownMapId;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** The Town Maps of a region, in the order the game switches between them. */
export const REGION_MAPS: Record<Region, { id: TownMapId; label: string }[]> = {
  hoenn: [{ id: "hoenn", label: "Hoenn" }],
  kanto: [
    { id: "kanto", label: "Kanto" },
    { id: "sevii-123", label: "Islands 1–3" },
    { id: "sevii-45", label: "Islands 4–5" },
    { id: "sevii-67", label: "Islands 6–7" },
  ],
};

export const areaKey = (region: Region, mapSection: string) =>
  `${region}:${mapSection}`;

/** A place's area, or null for the few with no spot (Navel Rock, Marine Cave…). */
export function areaFor(
  region: Region,
  mapSection: string,
): TownMapArea | null {
  const key = areaKey(region, mapSection);
  const area = TOWN_MAP_AREAS[key];
  return area ? { key, ...area } : null;
}

/**
 * The areas covering a tile, smallest first: a cave drawn on top of a
 * route (Granite Cave on Route 106) comes before the route.
 */
export function areasAt(
  region: Region,
  map: TownMapId,
  col: number,
  row: number,
): TownMapArea[] {
  return Object.entries(TOWN_MAP_AREAS)
    .filter(
      ([key, a]) =>
        key.startsWith(`${region}:`) &&
        a.map === map &&
        col >= a.x &&
        col < a.x + a.width &&
        row >= a.y &&
        row < a.y + a.height,
    )
    .map(([key, a]) => ({ key, ...a }))
    .sort(
      (a, b) =>
        a.width * a.height - b.width * b.height || a.name.localeCompare(b.name),
    );
}
