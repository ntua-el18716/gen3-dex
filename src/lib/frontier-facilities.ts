import type { FrontierFacility } from "@/db/schema";

/**
 * How each facility picks opponents, which decides its screen:
 * - trainers: Tower, Palace, Arena: trainers by battle number, sets by trainer
 * - dome: like the Tower, but by tournaments won in a row
 * - factory: sets by battle number, whoever the trainer is
 * - pike / pyramid: wild Pokémon by rooms / floors cleared
 */
export type FacilityKind = "trainers" | "dome" | "factory" | "pike" | "pyramid";

export type FacilityInfo = {
  key: FrontierFacility;
  name: string;
  /** One line on what makes it different. */
  rule: string;
  kind: FacilityKind;
  color: string;
  /** Material Symbols (Android/web) and SF Symbols (iOS) names. */
  icon: { android: string; ios: string };
};

export const FACILITIES: FacilityInfo[] = [
  {
    key: "tower",
    name: "Battle Tower",
    rule: "Straight battles, seven per challenge.",
    kind: "trainers",
    color: "#3B82F6",
    icon: { android: "apartment", ios: "building.2.fill" },
  },
  {
    key: "dome",
    name: "Battle Dome",
    rule: "Tournaments of 16; you see the opponents' teams.",
    kind: "dome",
    color: "#EF4444",
    icon: { android: "sports_mma", ios: "figure.boxing" },
  },
  {
    key: "palace",
    name: "Battle Palace",
    rule: "Pokémon pick their own moves, by nature.",
    kind: "trainers",
    color: "#8B5CF6",
    icon: { android: "self_improvement", ios: "figure.mind.and.body" },
  },
  {
    key: "arena",
    name: "Battle Arena",
    rule: "Three turns, then the judges decide.",
    kind: "trainers",
    color: "#F97316",
    icon: { android: "sports_kabaddi", ios: "figure.martial.arts" },
  },
  {
    key: "factory",
    name: "Battle Factory",
    rule: "Rental Pokémon; swap after each win.",
    kind: "factory",
    color: "#10B981",
    icon: { android: "factory", ios: "gearshape.2.fill" },
  },
  {
    key: "pike",
    name: "Battle Pike",
    rule: "Pick one of three doors, room after room.",
    kind: "pike",
    color: "#EAB308",
    icon: { android: "alt_route", ios: "arrow.triangle.branch" },
  },
  {
    key: "pyramid",
    name: "Battle Pyramid",
    rule: "Explore seven dark floors, no outside items.",
    kind: "pyramid",
    color: "#B45309",
    icon: { android: "change_history", ios: "triangle.fill" },
  },
];

export function facilityInfo(key: string): FacilityInfo | undefined {
  return FACILITIES.find((f) => f.key === key);
}
