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
// ---------------------------------------------------------------------------

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
  },
  (t) => [index("frontier_set_pokemon_idx").on(t.pokemonId)],
);

export const frontierTrainer = sqliteTable("frontier_trainer", {
  /** pret index into gFacilityTrainers. */
  id: integer("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  /** Display name of the trainer class, e.g. "Youngster". */
  trainerClass: text("trainer_class").notNull(),
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
