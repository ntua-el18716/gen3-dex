import type { Game, PokemonType } from "@/db/schema";

/**
 * The League page's trainers, per game, in story order. The data files
 * don't say which trainer is a gym's leader or where a rival battle takes
 * place, so that part is written by hand; teams come from the database.
 *
 * A trainer with several `variants` has rematch teams. A rival battle lists
 * one key per possible starter: the right one is picked from the team
 * (see pickForStarter in db/league-queries.ts), because each game names
 * those keys differently.
 */
export type LeagueTrainer = {
  /** e.g. "Rustboro City Gym". */
  place: string;
  /** e.g. "Stone Badge". */
  detail?: string;
  /** The gym's or Elite Four member's speciality. */
  type?: PokemonType;
  variants: { label: string; keys: string[] }[];
};

export type LeagueSection = {
  title: string;
  kind: "gym" | "elite" | "champion" | "rival";
  trainers: LeagueTrainer[];
};

export type Region = "hoenn" | "kanto";
export const REGION: Record<Game, Region> = {
  ruby: "hoenn",
  sapphire: "hoenn",
  emerald: "hoenn",
  firered: "kanto",
  leafgreen: "kanto",
};

/** The three starters you can pick, by National Dex number. */
export const STARTERS: Record<Region, number[]> = {
  hoenn: [252, 255, 258], // Treecko, Torchic, Mudkip
  kanto: [1, 4, 7], // Bulbasaur, Charmander, Squirtle
};

/** The rival takes the starter that beats yours: yours → theirs. */
export const RIVAL_STARTER: Record<number, number> = {
  252: 255, // Treecko → Torchic
  255: 258, // Torchic → Mudkip
  258: 252, // Mudkip → Treecko
  1: 4, // Bulbasaur → Charmander
  4: 7, // Charmander → Squirtle
  7: 1, // Squirtle → Bulbasaur
};

const one = (key: string) => [{ label: "", keys: [key] }];
/** "1st" for the first battle, "2nd"… for rematches. */
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];
const rematches = (keys: string[]) =>
  keys.map((key, i) => ({ label: ORDINALS[i]!, keys: [key] }));
const starters = (prefix: string, suffixes: string[]) =>
  suffixes.map((s) => `${prefix}${s}`);

const HOENN_GYMS: Omit<LeagueTrainer, "variants">[] = [
  { place: "Rustboro City Gym", detail: "Stone Badge", type: "rock" },
  { place: "Dewford Town Gym", detail: "Knuckle Badge", type: "fighting" },
  { place: "Mauville City Gym", detail: "Dynamo Badge", type: "electric" },
  { place: "Lavaridge Town Gym", detail: "Heat Badge", type: "fire" },
  { place: "Petalburg City Gym", detail: "Balance Badge", type: "normal" },
  { place: "Fortree City Gym", detail: "Feather Badge", type: "flying" },
  { place: "Mossdeep City Gym", detail: "Mind Badge", type: "psychic" },
  { place: "Sootopolis City Gym", detail: "Rain Badge", type: "water" },
];
const HOENN_ELITE: Omit<LeagueTrainer, "variants">[] = [
  { place: "Elite Four", detail: "First room", type: "dark" },
  { place: "Elite Four", detail: "Second room", type: "ghost" },
  { place: "Elite Four", detail: "Third room", type: "ice" },
  { place: "Elite Four", detail: "Fourth room", type: "dragon" },
];
const HOENN_LEADERS_RS = [
  "ROXANNE",
  "BRAWLY",
  "WATTSON",
  "FLANNERY",
  "NORMAN",
  "WINONA",
  "TATE_AND_LIZA",
  "WALLACE",
];
const HOENN_LEADERS_E = [...HOENN_LEADERS_RS.slice(0, 7), "JUAN"];
const ELITE_HOENN = ["SIDNEY", "PHOEBE", "GLACIA", "DRAKE"];

function rubySapphire(): LeagueSection[] {
  return [
    {
      title: "Gym Leaders",
      kind: "gym",
      trainers: HOENN_GYMS.map((g, i) => ({
        ...g,
        variants: one(`TRAINER_${HOENN_LEADERS_RS[i]}`),
      })),
    },
    {
      title: "Elite Four",
      kind: "elite",
      trainers: HOENN_ELITE.map((e, i) => ({
        ...e,
        variants: one(`TRAINER_${ELITE_HOENN[i]}`),
      })),
    },
    {
      title: "Champion",
      kind: "champion",
      trainers: [
        {
          place: "Ever Grande City",
          type: "steel",
          variants: one("TRAINER_STEVEN"),
        },
      ],
    },
    {
      title: "Rivals",
      kind: "rival",
      trainers: [
        ["Route 103", [1, 4, 7]],
        ["Route 110", [2, 5, 8]],
        ["Route 119", [3, 6, 9]],
      ]
        .map(([place, n]) => ({
          place: place as string,
          detail: "Brendan / May",
          variants: [
            {
              label: "",
              keys: (n as number[]).map((i) => `TRAINER_BRENDAN_${i}`),
            },
          ],
        }))
        .concat([
          {
            place: "Lilycove City",
            detail: "Brendan / May",
            variants: [
              {
                label: "",
                keys: starters("TRAINER_BRENDAN_LILYCOVE_", [
                  "TREECKO",
                  "TORCHIC",
                  "MUDKIP",
                ]),
              },
            ],
          },
          {
            place: "Mauville City",
            detail: "Wally",
            variants: one("TRAINER_WALLY_2"),
          },
          {
            place: "Victory Road",
            detail: "Wally",
            variants: rematches([
              "TRAINER_WALLY_1",
              "TRAINER_WALLY_3",
              "TRAINER_WALLY_4",
              "TRAINER_WALLY_5",
              "TRAINER_WALLY_6",
            ]),
          },
        ]),
    },
  ];
}

function emerald(): LeagueSection[] {
  const hoennStarters = ["TREECKO", "TORCHIC", "MUDKIP"];
  const rival = (place: string, spot: string) => ({
    place,
    detail: "Brendan / May",
    variants: [
      {
        label: "",
        keys: starters(`TRAINER_BRENDAN_${spot}_`, hoennStarters),
      },
    ],
  });
  return [
    {
      title: "Gym Leaders",
      kind: "gym",
      trainers: HOENN_GYMS.map((g, i) => ({
        ...g,
        // Emerald adds four rematch teams per leader (via the Match Call).
        variants: rematches(
          [1, 2, 3, 4, 5].map((n) => `TRAINER_${HOENN_LEADERS_E[i]}_${n}`),
        ),
      })),
    },
    {
      title: "Elite Four",
      kind: "elite",
      trainers: HOENN_ELITE.map((e, i) => ({
        ...e,
        variants: one(`TRAINER_${ELITE_HOENN[i]}`),
      })),
    },
    {
      title: "Champion",
      kind: "champion",
      trainers: [
        {
          place: "Ever Grande City",
          type: "water",
          variants: one("TRAINER_WALLACE"),
        },
      ],
    },
    {
      title: "Rivals",
      kind: "rival",
      trainers: [
        rival("Route 103", "ROUTE_103"),
        rival("Rustboro City", "RUSTBORO"),
        rival("Route 110", "ROUTE_110"),
        rival("Route 119", "ROUTE_119"),
        rival("Lilycove City", "LILYCOVE"),
        {
          place: "Mauville City",
          detail: "Wally",
          variants: one("TRAINER_WALLY_MAUVILLE"),
        },
        {
          place: "Victory Road",
          detail: "Wally",
          variants: rematches(
            [1, 2, 3, 4, 5].map((n) => `TRAINER_WALLY_VR_${n}`),
          ),
        },
      ],
    },
  ];
}

function fireRedLeafGreen(): LeagueSection[] {
  const kantoStarters = ["BULBASAUR", "CHARMANDER", "SQUIRTLE"];
  const rival = (place: string, spot: string) => ({
    place,
    detail: "Rival",
    variants: [
      { label: "", keys: starters(`TRAINER_RIVAL_${spot}_`, kantoStarters) },
    ],
  });
  const gyms: [string, string, PokemonType, string][] = [
    ["Pewter City Gym", "Boulder Badge", "rock", "BROCK"],
    ["Cerulean City Gym", "Cascade Badge", "water", "MISTY"],
    ["Vermilion City Gym", "Thunder Badge", "electric", "LT_SURGE"],
    ["Celadon City Gym", "Rainbow Badge", "grass", "ERIKA"],
    ["Fuchsia City Gym", "Soul Badge", "poison", "KOGA"],
    ["Saffron City Gym", "Marsh Badge", "psychic", "SABRINA"],
    ["Cinnabar Island Gym", "Volcano Badge", "fire", "BLAINE"],
    ["Viridian City Gym", "Earth Badge", "ground", "GIOVANNI"],
  ];
  const elite: [string, PokemonType, string][] = [
    ["First room", "ice", "LORELEI"],
    ["Second room", "fighting", "BRUNO"],
    ["Third room", "ghost", "AGATHA"],
    ["Fourth room", "dragon", "LANCE"],
  ];
  return [
    {
      title: "Gym Leaders",
      kind: "gym",
      trainers: gyms.map(([place, detail, type, key]) => ({
        place,
        detail,
        type,
        variants: one(`TRAINER_LEADER_${key}`),
      })),
    },
    {
      title: "Elite Four",
      kind: "elite",
      trainers: elite.map(([detail, type, key]) => ({
        place: "Elite Four",
        detail,
        type,
        // The rematch teams after the Sevii Islands story.
        variants: rematches([
          `TRAINER_ELITE_FOUR_${key}`,
          `TRAINER_ELITE_FOUR_${key}_2`,
        ]),
      })),
    },
    {
      title: "Champion",
      kind: "champion",
      trainers: [
        {
          place: "Indigo Plateau",
          variants: [
            {
              label: "1st",
              keys: starters("TRAINER_CHAMPION_FIRST_", kantoStarters),
            },
            {
              label: "2nd",
              keys: starters("TRAINER_CHAMPION_REMATCH_", kantoStarters),
            },
          ],
        },
      ],
    },
    {
      title: "Rivals",
      kind: "rival",
      trainers: [
        rival("Oak's Lab", "OAKS_LAB"),
        rival("Route 22", "ROUTE22_EARLY"),
        rival("Cerulean City", "CERULEAN"),
        rival("S.S. Anne", "SS_ANNE"),
        rival("Pokémon Tower", "POKEMON_TOWER"),
        rival("Silph Co.", "SILPH"),
        rival("Route 22 (again)", "ROUTE22_LATE"),
      ],
    },
  ];
}

/** The League page's sections for a game. */
export function leagueFor(game: Game): LeagueSection[] {
  if (game === "emerald") return emerald();
  if (game === "ruby" || game === "sapphire") return rubySapphire();
  return fireRedLeafGreen();
}
