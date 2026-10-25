/**
 * The Gen 3 database schema, shared by the importer (which writes the
 * database) and the app (which reads it with typed Drizzle queries).
 *
 * Everything is imported from the pret decompilations of the games, so the
 * values are the games' own, not modern-generation data.
 *
 * Granularity:
 * - Data that is identical in all five games (base stats, moves, abilities…)
 *   is stored once.
 * - Data that differs between FireRed/LeafGreen, Ruby/Sapphire and Emerald
 *   (wild held items) is keyed by `versionGroup`.
 * - Data that differs between individual games (Pokédex text, learnsets,
 *   wild encounters, trainers) is keyed by `game`.
 */
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const GAMES = [
  "ruby",
  "sapphire",
  "emerald",
  "firered",
  "leafgreen",
] as const;
export type Game = (typeof GAMES)[number];

export const VERSION_GROUPS = ["rs", "e", "frlg"] as const;
export type VersionGroup = (typeof VERSION_GROUPS)[number];

/** The 17 Gen 3 types plus "???" (used by Curse). No Fairy in Gen 3. */
export const TYPES = [
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "steel",
  "???",
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
] as const;
export type PokemonType = (typeof TYPES)[number];

export const EGG_GROUPS = [
  "monster",
  "water-1",
  "bug",
  "flying",
  "field",
  "fairy",
  "grass",
  "human-like",
  "water-3",
  "mineral",
  "amorphous",
  "water-2",
  "ditto",
  "dragon",
  "undiscovered",
] as const;
export type EggGroup = (typeof EGG_GROUPS)[number];

export const GROWTH_RATES = [
  "medium-fast",
  "erratic",
  "fluctuating",
  "medium-slow",
  "fast",
  "slow",
] as const;
export type GrowthRate = (typeof GROWTH_RATES)[number];

export const BODY_COLORS = [
  "red",
  "blue",
  "yellow",
  "green",
  "black",
  "brown",
  "purple",
  "gray",
  "white",
  "pink",
] as const;

/** Stats in the order the games store them. */
export const STATS = [
  "hp",
  "attack",
  "defense",
  "speed",
  "spAttack",
  "spDefense",
] as const;
export type Stat = (typeof STATS)[number];

export const LEARN_METHODS = ["level", "machine", "tutor", "egg"] as const;
export type LearnMethod = (typeof LEARN_METHODS)[number];

export const ENCOUNTER_METHODS = [
  "grass",
  "surf",
  "rock-smash",
  "old-rod",
  "good-rod",
  "super-rod",
] as const;
export type EncounterMethod = (typeof ENCOUNTER_METHODS)[number];

/** Ways to get a Pokémon once, outside the wild encounter tables. */
export const STATIC_ENCOUNTER_KINDS = [
  "starter",
  "gift",
  "egg",
  "static",
  "roaming",
  "trade",
  "prize",
] as const;
export type StaticEncounterKind = (typeof STATIC_ENCOUNTER_KINDS)[number];

export const EVOLUTION_METHODS = [
  "level",
  "level-attack-gt-defense",
  "level-attack-eq-defense",
  "level-attack-lt-defense",
  "level-silcoon",
  "level-cascoon",
  "level-ninjask",
  "level-shedinja",
  "item",
  "trade",
  "trade-item",
  "friendship",
  "friendship-day",
  "friendship-night",
  "beauty",
] as const;
export type EvolutionMethod = (typeof EVOLUTION_METHODS)[number];

export const BAG_POCKETS = [
  "items",
  "poke-balls",
  "tms-hms",
  "berries",
  "key-items",
] as const;

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export const game = sqliteTable("game", {
  id: text("id", { enum: GAMES }).primaryKey(),
  name: text("name").notNull(),
  versionGroup: text("version_group", { enum: VERSION_GROUPS }).notNull(),
  region: text("region", { enum: ["hoenn", "kanto"] }).notNull(),
  /** Display order in the app. */
  sortOrder: integer("sort_order").notNull(),
});

// ---------------------------------------------------------------------------
// Core reference data (identical in every Gen 3 game)
// ---------------------------------------------------------------------------

export const ability = sqliteTable("ability", {
  id: integer("id").primaryKey(),
  /** pret constant, e.g. ABILITY_LEVITATE. */
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
});

export const move = sqliteTable("move", {
  id: integer("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  type: text("type", { enum: TYPES }).notNull(),
  /** 0 for status moves; 1 for moves whose power is calculated (e.g. Low Kick). */
  power: integer("power").notNull(),
  /** 0 means the move never misses. */
  accuracy: integer("accuracy").notNull(),
  pp: integer("pp").notNull(),
  priority: integer("priority").notNull(),
  /** Chance (%) of the secondary effect, 0 if none. */
  effectChance: integer("effect_chance").notNull(),
  /** pret effect constant, e.g. EFFECT_PARALYZE_HIT. */
  effect: text("effect").notNull(),
  /** pret target constant, e.g. MOVE_TARGET_SELECTED. */
  target: text("target").notNull(),
  makesContact: integer("makes_contact", { mode: "boolean" }).notNull(),
  description: text("description").notNull(),
  // No physical/special column: in Gen 3 that depends on the move's type.
  // See src/lib/damage-class.ts.
});

export const item = sqliteTable("item", {
  id: integer("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  pocket: text("pocket", { enum: BAG_POCKETS }),
  /** pret hold-effect constant, e.g. HOLD_EFFECT_LEFTOVERS; null if none. */
  holdEffect: text("hold_effect"),
});

export const nature = sqliteTable("nature", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  /** Null for neutral natures. */
  increasedStat: text("increased_stat", { enum: STATS }),
  decreasedStat: text("decreased_stat", { enum: STATS }),
});

export const typeChart = sqliteTable(
  "type_chart",
  {
    attackingType: text("attacking_type", { enum: TYPES }).notNull(),
    defendingType: text("defending_type", { enum: TYPES }).notNull(),
    /** 0, 0.5 or 2. Pairs not listed are 1×. */
    multiplier: real("multiplier").notNull(),
  },
  (t) => [primaryKey({ columns: [t.attackingType, t.defendingType] })],
);

// ---------------------------------------------------------------------------
// Pokémon
// ---------------------------------------------------------------------------

export const pokemon = sqliteTable("pokemon", {
  /** National Pokédex number (1–386). */
  id: integer("id").primaryKey(),
  /** pret constant, e.g. SPECIES_GENGAR. */
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  /** Hoenn Pokédex number, null if not in the Hoenn Dex. */
  hoennDexNumber: integer("hoenn_dex_number"),
  type1: text("type1", { enum: TYPES }).notNull(),
  /** Null for single-type Pokémon. */
  type2: text("type2", { enum: TYPES }),
  ability1Id: integer("ability1_id")
    .notNull()
    .references(() => ability.id),
  ability2Id: integer("ability2_id").references(() => ability.id),

  hp: integer("hp").notNull(),
  attack: integer("attack").notNull(),
  defense: integer("defense").notNull(),
  speed: integer("speed").notNull(),
  spAttack: integer("sp_attack").notNull(),
  spDefense: integer("sp_defense").notNull(),

  evHp: integer("ev_hp").notNull(),
  evAttack: integer("ev_attack").notNull(),
  evDefense: integer("ev_defense").notNull(),
  evSpeed: integer("ev_speed").notNull(),
  evSpAttack: integer("ev_sp_attack").notNull(),
  evSpDefense: integer("ev_sp_defense").notNull(),

  catchRate: integer("catch_rate").notNull(),
  baseExperience: integer("base_experience").notNull(),
  /**
   * The game's raw gender value: 0 = always male, 254 = always female,
   * 255 = genderless, otherwise the female threshold out of 256.
   */
  genderRatio: integer("gender_ratio").notNull(),
  eggCycles: integer("egg_cycles").notNull(),
  baseFriendship: integer("base_friendship").notNull(),
  growthRate: text("growth_rate", { enum: GROWTH_RATES }).notNull(),
  eggGroup1: text("egg_group1", { enum: EGG_GROUPS }).notNull(),
  /** Null when the Pokémon has only one egg group. */
  eggGroup2: text("egg_group2", { enum: EGG_GROUPS }),
  bodyColor: text("body_color", { enum: BODY_COLORS }).notNull(),
  safariFleeRate: integer("safari_flee_rate").notNull(),

  /** Pokédex data. Height in decimetres, weight in hectograms (the games' units). */
  category: text("category").notNull(),
  heightDm: integer("height_dm").notNull(),
  weightHg: integer("weight_hg").notNull(),
});

/**
 * Per-game base stat overrides. Only Deoxys: its form depends on the game
 * (Normal in R/S, Attack in FireRed, Defense in LeafGreen, Speed in Emerald).
 */
export const baseStatOverride = sqliteTable(
  "base_stat_override",
  {
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    game: text("game", { enum: GAMES })
      .notNull()
      .references(() => game.id),
    formName: text("form_name").notNull(),
    hp: integer("hp").notNull(),
    attack: integer("attack").notNull(),
    defense: integer("defense").notNull(),
    speed: integer("speed").notNull(),
    spAttack: integer("sp_attack").notNull(),
    spDefense: integer("sp_defense").notNull(),
  },
  (t) => [primaryKey({ columns: [t.pokemonId, t.game] })],
);

/** Items a wild Pokémon can hold; these differ between version groups. */
export const wildHeldItem = sqliteTable(
  "wild_held_item",
  {
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    versionGroup: text("version_group", { enum: VERSION_GROUPS }).notNull(),
    rarity: text("rarity", { enum: ["common", "rare"] }).notNull(),
    itemId: integer("item_id")
      .notNull()
      .references(() => item.id),
  },
  (t) => [primaryKey({ columns: [t.pokemonId, t.versionGroup, t.rarity] })],
);

export const pokedexText = sqliteTable(
  "pokedex_text",
  {
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    game: text("game", { enum: GAMES })
      .notNull()
      .references(() => game.id),
    text: text("text").notNull(),
  },
  (t) => [primaryKey({ columns: [t.pokemonId, t.game] })],
);

export const evolution = sqliteTable(
  "evolution",
  {
    fromPokemonId: integer("from_pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    toPokemonId: integer("to_pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    method: text("method", { enum: EVOLUTION_METHODS }).notNull(),
    /** Level for level methods, beauty value for "beauty", null otherwise. */
    level: integer("level"),
    /** The item for "item" and "trade-item". */
    itemId: integer("item_id").references(() => item.id),
  },
  (t) => [
    primaryKey({ columns: [t.fromPokemonId, t.toPokemonId, t.method] }),
    index("evolution_to_idx").on(t.toPokemonId),
  ],
);

// ---------------------------------------------------------------------------
// Learnsets
// ---------------------------------------------------------------------------

/** TM/HM numbers. TM01–TM50 are 1–50, HM01–HM08 are 51–58. */
export const machine = sqliteTable("machine", {
  number: integer("number").primaryKey(),
  /** Display label, e.g. "TM26" or "HM03". */
  label: text("label").notNull().unique(),
  moveId: integer("move_id")
    .notNull()
    .references(() => move.id),
});

/**
 * Keyed by game rather than version group: FireRed and LeafGreen differ for
 * Deoxys (Attack vs Defense Forme), and per-game rows keep queries simple.
 */
export const learnset = sqliteTable(
  "learnset",
  {
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    game: text("game", { enum: GAMES })
      .notNull()
      .references(() => game.id),
    moveId: integer("move_id")
      .notNull()
      .references(() => move.id),
    method: text("method", { enum: LEARN_METHODS }).notNull(),
    /** Level for "level"; 0 for the rest. A move can be learned at several levels. */
    level: integer("level").notNull(),
    /** Position in the game's level-up list (it decides default movesets); 0 for other methods. */
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.pokemonId, t.game, t.moveId, t.method, t.level] }),
    index("learnset_move_idx").on(t.moveId, t.game),
  ],
);

// ---------------------------------------------------------------------------
// Wild encounters
// ---------------------------------------------------------------------------

export const location = sqliteTable(
  "location",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** pret map constant, e.g. MAP_ROUTE101. Unique within a region. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    region: text("region", { enum: ["hoenn", "kanto"] }).notNull(),
  },
  (t) => [uniqueIndex("location_region_key_idx").on(t.region, t.key)],
);

/**
 * One row per encounter slot, exactly as the game stores it. A Pokémon can
 * occupy several slots; add their `rate`s up for its total chance.
 */
export const encounter = sqliteTable(
  "encounter",
  {
    game: text("game", { enum: GAMES })
      .notNull()
      .references(() => game.id),
    locationId: integer("location_id")
      .notNull()
      .references(() => location.id),
    method: text("method", { enum: ENCOUNTER_METHODS }).notNull(),
    slot: integer("slot").notNull(),
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    minLevel: integer("min_level").notNull(),
    maxLevel: integer("max_level").notNull(),
    /** Chance (%) of this slot when an encounter happens with this method. */
    rate: integer("rate").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.game, t.locationId, t.method, t.slot] }),
    index("encounter_pokemon_idx").on(t.pokemonId, t.game),
  ],
);

/**
 * Pokémon you get once rather than from an encounter table: starters,
 * gifts, eggs, legendaries and other overworld Pokémon (`static`), roamers,
 * in-game trades and Game Corner prizes. Read from the map scripts, so a
 * row is only here if a map in that game actually runs the script.
 * Where you choose between several (starters, fossils, the Dojo), each
 * option is a row.
 */
export const staticEncounter = sqliteTable(
  "static_encounter",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    game: text("game", { enum: GAMES })
      .notNull()
      .references(() => game.id),
    /** Null for roamers, which move between routes. */
    locationId: integer("location_id").references(() => location.id),
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    kind: text("kind", { enum: STATIC_ENCOUNTER_KINDS }).notNull(),
    /** Null for trades: the Pokémon keeps the level of the one you give. Eggs: the hatch level. */
    level: integer("level"),
    /** How many there are at this place (e.g. 3 Voltorb in New Mauville). */
    count: integer("count").notNull(),
    heldItemId: integer("held_item_id").references(() => item.id),
    /** Trades: the Pokémon the trainer asks for. */
    tradeForId: integer("trade_for_id").references(() => pokemon.id),
    /** Trades: the nickname it comes with. */
    nickname: text("nickname"),
    /** Hand-written hint (requirements, choices); null when there is nothing to add. */
    note: text("note"),
  },
  (t) => [index("static_encounter_pokemon_idx").on(t.pokemonId, t.game)],
);

// ---------------------------------------------------------------------------
// Trainers
// ---------------------------------------------------------------------------

export const trainer = sqliteTable(
  "trainer",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    game: text("game", { enum: GAMES })
      .notNull()
      .references(() => game.id),
    /** pret constant, e.g. TRAINER_ROXANNE_1. Unique per game. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    /** Display name of the trainer class, e.g. "Leader". */
    trainerClass: text("trainer_class").notNull(),
    isDouble: integer("is_double", { mode: "boolean" }).notNull(),
    /** Healing items the trainer uses in battle, comma-separated item ids. */
    itemIds: text("item_ids").notNull(),
  },
  (t) => [index("trainer_game_key_idx").on(t.game, t.key)],
);

export const trainerMon = sqliteTable(
  "trainer_mon",
  {
    trainerId: integer("trainer_id")
      .notNull()
      .references(() => trainer.id),
    slot: integer("slot").notNull(),
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    level: integer("level").notNull(),
    /** Each IV (0–31) of this Pokémon, derived from the game's 0–255 value. */
    iv: integer("iv").notNull(),
    heldItemId: integer("held_item_id").references(() => item.id),
    move1Id: integer("move1_id").references(() => move.id),
    move2Id: integer("move2_id").references(() => move.id),
    move3Id: integer("move3_id").references(() => move.id),
    move4Id: integer("move4_id").references(() => move.id),
    /**
     * True when the game gives this Pokémon its default moveset (the last four
     * level-up moves at its level) and the importer computed the moves.
     */
    movesComputed: integer("moves_computed", { mode: "boolean" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.trainerId, t.slot] }),
    index("trainer_mon_pokemon_idx").on(t.pokemonId),
  ],
);

// ---------------------------------------------------------------------------
// Battle Frontier (Emerald)
//
// How opponents are chosen (Battle Tower, Palace and Arena; the Factory picks
// trainers the same way but builds their teams from rentals, and the Dome,
// Pike and Pyramid have their own rules):
// - A streak is split into challenges of 7 battles. For the next battle the
//   game draws a trainer from frontier_trainer_range for that challenge (the
//   7th battle uses a harder range), never one already fought in the challenge.
// - The trainer's team is 3 random sets from their list (frontier_trainer_set)
//   with no repeated species or held item; in Level 50 mode the
//   open-level-only sets are skipped. All IVs equal the trainer's fixed IV.
// - At set battle numbers the facility's Frontier Brain appears instead
//   (frontier_brain), with a fixed team (frontier_brain_mon).
// See src/lib/frontier.ts for the rules as code.
// ---------------------------------------------------------------------------

export const FRONTIER_FACILITIES = [
  "tower",
  "dome",
  "palace",
  "arena",
  "factory",
  "pike",
  "pyramid",
] as const;
export type FrontierFacility = (typeof FRONTIER_FACILITIES)[number];

export const FRONTIER_SYMBOLS = ["silver", "gold"] as const;
export type FrontierSymbol = (typeof FRONTIER_SYMBOLS)[number];

export const FRONTIER_LEVEL_MODES = ["50", "open"] as const;
export type FrontierLevelMode = (typeof FRONTIER_LEVEL_MODES)[number];

export const frontierSet = sqliteTable(
  "frontier_set",
  {
    /** pret index into gBattleFrontierMons. */
    id: integer("id").primaryKey(),
    key: text("key").notNull().unique(),
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    move1Id: integer("move1_id").references(() => move.id),
    move2Id: integer("move2_id").references(() => move.id),
    move3Id: integer("move3_id").references(() => move.id),
    move4Id: integer("move4_id").references(() => move.id),
    itemId: integer("item_id").references(() => item.id),
    natureId: integer("nature_id")
      .notNull()
      .references(() => nature.id),
    /** EVs in each stat, as the game assigns them (510 split between the chosen stats). */
    evHp: integer("ev_hp").notNull(),
    evAttack: integer("ev_attack").notNull(),
    evDefense: integer("ev_defense").notNull(),
    evSpeed: integer("ev_speed").notNull(),
    evSpAttack: integer("ev_sp_attack").notNull(),
    evSpDefense: integer("ev_sp_defense").notNull(),
    /** "High tier" sets (after FRONTIER_MONS_HIGH_TIER): never used in Level 50 mode. */
    openLevelOnly: integer("open_level_only", { mode: "boolean" }).notNull(),
  },
  (t) => [index("frontier_set_pokemon_idx").on(t.pokemonId)],
);

export const frontierTrainer = sqliteTable("frontier_trainer", {
  /** pret index into gFacilityTrainers. Higher ids are harder trainers. */
  id: integer("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  /** Display name of the trainer class, e.g. "Youngster". */
  trainerClass: text("trainer_class").notNull(),
  /** Every IV of this trainer's Pokémon (GetFrontierTrainerFixedIvs). */
  fixedIv: integer("fixed_iv").notNull(),
});

/**
 * The trainer ids the game draws from for a challenge (sFrontierTrainerIdRanges
 * and …Hard). `challenge` is the streak divided by 7 (0 = battles 1–7);
 * challenges after 7 reuse challenge 7. `lastBattle` rows apply to the 7th
 * battle of the challenge.
 */
export const frontierTrainerRange = sqliteTable(
  "frontier_trainer_range",
  {
    challenge: integer("challenge").notNull(),
    lastBattle: integer("last_battle", { mode: "boolean" }).notNull(),
    firstTrainerId: integer("first_trainer_id")
      .notNull()
      .references(() => frontierTrainer.id),
    lastTrainerId: integer("last_trainer_id")
      .notNull()
      .references(() => frontierTrainer.id),
  },
  (t) => [primaryKey({ columns: [t.challenge, t.lastBattle] })],
);

/**
 * Each facility's Frontier Brain and when they appear (single battles only).
 * With n = the number of the battle about to be fought in the streak (1 =
 * first; for the Dome and Pyramid the game counts rounds differently, hence
 * `streakOffset`), the Brain appears when n - 1 + streakOffset equals
 * `silverAt` (Silver Symbol), `goldAt` (Gold Symbol), or, once both Symbols
 * are won, goldAt + any multiple of `repeatEvery` (gold team).
 */
export const frontierBrain = sqliteTable("frontier_brain", {
  facility: text("facility", { enum: FRONTIER_FACILITIES }).primaryKey(),
  name: text("name").notNull(),
  /** Display name of the trainer class, e.g. "Salon Maiden". */
  trainerClass: text("trainer_class").notNull(),
  silverAt: integer("silver_at").notNull(),
  goldAt: integer("gold_at").notNull(),
  repeatEvery: integer("repeat_every").notNull(),
  streakOffset: integer("streak_offset").notNull(),
});

/**
 * The Frontier Brains' fixed teams, per Symbol. None for the Factory: its
 * Brain uses random rental Pokémon (pret's table entry for it is unused).
 */
export const frontierBrainMon = sqliteTable(
  "frontier_brain_mon",
  {
    facility: text("facility", { enum: FRONTIER_FACILITIES })
      .notNull()
      .references(() => frontierBrain.facility),
    symbol: text("symbol", { enum: FRONTIER_SYMBOLS }).notNull(),
    slot: integer("slot").notNull(),
    pokemonId: integer("pokemon_id")
      .notNull()
      .references(() => pokemon.id),
    itemId: integer("item_id").references(() => item.id),
    natureId: integer("nature_id")
      .notNull()
      .references(() => nature.id),
    fixedIv: integer("fixed_iv").notNull(),
    evHp: integer("ev_hp").notNull(),
    evAttack: integer("ev_attack").notNull(),
    evDefense: integer("ev_defense").notNull(),
    evSpeed: integer("ev_speed").notNull(),
    evSpAttack: integer("ev_sp_attack").notNull(),
    evSpDefense: integer("ev_sp_defense").notNull(),
    move1Id: integer("move1_id").references(() => move.id),
    move2Id: integer("move2_id").references(() => move.id),
    move3Id: integer("move3_id").references(() => move.id),
    move4Id: integer("move4_id").references(() => move.id),
  },
  (t) => [primaryKey({ columns: [t.facility, t.symbol, t.slot] })],
);

/**
 * Battle Factory: the sets the game draws from, per level mode and
 * challenge (sInitialRentalMonRanges; challenges after 7 reuse 7). Unlike
 * the Tower, opponents' Pokémon don't depend on the trainer: each is a
 * random set id in this range (never Unown, never a species among the
 * player's rentals; Level 50 skips the open-level-only sets). Rentals come
 * from the same range, or partly from the next challenge's after many past
 * rentals.
 */
export const factorySetRange = sqliteTable(
  "factory_set_range",
  {
    levelMode: text("level_mode", { enum: FRONTIER_LEVEL_MODES }).notNull(),
    challenge: integer("challenge").notNull(),
    firstSetId: integer("first_set_id")
      .notNull()
      .references(() => frontierSet.id),
    lastSetId: integer("last_set_id")
      .notNull()
      .references(() => frontierSet.id),
  },
  (t) => [primaryKey({ columns: [t.levelMode, t.challenge] })],
);

/**
 * Battle Factory IVs per challenge row (sFixedIVTable): every IV of a
 * Pokémon equals `iv`, or `lastBattleIv` in the 7th battle of a challenge.
 * Which row applies has quirks (the game reads the Battle Tower streak);
 * see factoryOpponentIv in src/lib/frontier.ts.
 */
export const factoryIv = sqliteTable("factory_iv", {
  challenge: integer("challenge").primaryKey(),
  iv: integer("iv").notNull(),
  lastBattleIv: integer("last_battle_iv").notNull(),
});

/** Which sets each Frontier trainer can draw from. */
export const frontierTrainerSet = sqliteTable(
  "frontier_trainer_set",
  {
    trainerId: integer("trainer_id")
      .notNull()
      .references(() => frontierTrainer.id),
    setId: integer("set_id")
      .notNull()
      .references(() => frontierSet.id),
  },
  (t) => [
    primaryKey({ columns: [t.trainerId, t.setId] }),
    index("frontier_trainer_set_set_idx").on(t.setId),
  ],
);

// ---------------------------------------------------------------------------
// Build metadata
// ---------------------------------------------------------------------------

/** Key/value info about how the database was built (pret commits, date…). */
export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
