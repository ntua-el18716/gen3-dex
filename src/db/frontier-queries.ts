/**
 * Battle Frontier queries (see src/lib/frontier.ts for the rules). They take
 * the same synchronous Db as queries.ts and are tested on the real gen3.db.
 */
import { and, asc, between, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import {
  battlePosition,
  type FactoryIvRow,
  type LevelMode,
} from "@/lib/frontier";
import type { StatSpread } from "@/lib/stats";

import type { Db } from "./queries";
import {
  factoryIv,
  factorySetRange,
  frontierBrain,
  frontierBrainMon,
  frontierSet,
  frontierTrainer,
  frontierTrainerRange,
  frontierTrainerSet,
  item,
  move,
  nature,
  pokemon,
  type FrontierFacility,
  type Stat,
} from "./schema";

/**
 * The trainers that can be drawn for battle `battle` (1 = first of the
 * streak) in the Battle Tower, Palace or Arena.
 */
export function getTrainersForBattle(db: Db, battle: number) {
  const position = battlePosition(battle);
  const range = db
    .select()
    .from(frontierTrainerRange)
    .where(
      and(
        eq(frontierTrainerRange.challenge, position.rangeChallenge),
        eq(frontierTrainerRange.lastBattle, position.lastBattle),
      ),
    )
    .get();
  if (!range) throw new Error(`No trainer range for battle ${battle}`);
  const trainers = db
    .select({
      id: frontierTrainer.id,
      name: frontierTrainer.name,
      trainerClass: frontierTrainer.trainerClass,
      fixedIv: frontierTrainer.fixedIv,
    })
    .from(frontierTrainer)
    .where(
      between(frontierTrainer.id, range.firstTrainerId, range.lastTrainerId),
    )
    .orderBy(asc(frontierTrainer.id))
    .all();
  return { ...position, trainers };
}

export type FrontierSetDetail = {
  id: number;
  pokemonId: number;
  species: string;
  baseStats: StatSpread;
  moves: string[];
  item: string | null;
  nature: string;
  increasedStat: Stat | null;
  decreasedStat: Stat | null;
  evs: StatSpread;
  openLevelOnly: boolean;
};

/** Full details of the given sets (species, moves, item, nature, EVs). */
export function getSetDetails(db: Db, setIds: number[]): FrontierSetDetail[] {
  if (setIds.length === 0) return [];
  const [m1, m2, m3, m4] = [1, 2, 3, 4].map((n) => alias(move, `m${n}`));
  const rows = db
    .select({
      set: frontierSet,
      species: pokemon.name,
      hp: pokemon.hp,
      attack: pokemon.attack,
      defense: pokemon.defense,
      speed: pokemon.speed,
      spAttack: pokemon.spAttack,
      spDefense: pokemon.spDefense,
      move1: m1!.name,
      move2: m2!.name,
      move3: m3!.name,
      move4: m4!.name,
      item: item.name,
      nature: nature.name,
      increasedStat: nature.increasedStat,
      decreasedStat: nature.decreasedStat,
    })
    .from(frontierSet)
    .innerJoin(pokemon, eq(pokemon.id, frontierSet.pokemonId))
    .innerJoin(nature, eq(nature.id, frontierSet.natureId))
    .leftJoin(item, eq(item.id, frontierSet.itemId))
    .leftJoin(m1!, eq(m1!.id, frontierSet.move1Id))
    .leftJoin(m2!, eq(m2!.id, frontierSet.move2Id))
    .leftJoin(m3!, eq(m3!.id, frontierSet.move3Id))
    .leftJoin(m4!, eq(m4!.id, frontierSet.move4Id))
    .where(inArray(frontierSet.id, setIds))
    .orderBy(asc(frontierSet.id))
    .all();
  return rows.map((r) => ({
    id: r.set.id,
    pokemonId: r.set.pokemonId,
    species: r.species,
    baseStats: {
      hp: r.hp,
      attack: r.attack,
      defense: r.defense,
      speed: r.speed,
      spAttack: r.spAttack,
      spDefense: r.spDefense,
    },
    moves: [r.move1, r.move2, r.move3, r.move4].filter(
      (m): m is string => m !== null,
    ),
    item: r.item,
    nature: r.nature,
    // Neutral natures raise and lower the same stat; store them as null.
    increasedStat: r.increasedStat === r.decreasedStat ? null : r.increasedStat,
    decreasedStat: r.increasedStat === r.decreasedStat ? null : r.decreasedStat,
    evs: {
      hp: r.set.evHp,
      attack: r.set.evAttack,
      defense: r.set.evDefense,
      speed: r.set.evSpeed,
      spAttack: r.set.evSpAttack,
      spDefense: r.set.evSpDefense,
    },
    openLevelOnly: r.set.openLevelOnly,
  }));
}

/**
 * The predictor: every set the opponent's Pokémon could be at battle
 * `battle`, given its species and optionally the trainer's id. Each set
 * comes with the trainers who could field it and their possible IVs.
 */
export function getPossibleSets(
  db: Db,
  {
    battle,
    levelMode,
    pokemonId,
    trainerId,
  }: {
    battle: number;
    levelMode: LevelMode;
    pokemonId?: number;
    trainerId?: number;
  },
) {
  const { trainers } = getTrainersForBattle(db, battle);
  const candidates = trainers.filter(
    (t) => trainerId === undefined || t.id === trainerId,
  );
  if (candidates.length === 0) return [];

  const links = db
    .select({
      setId: frontierTrainerSet.setId,
      trainerId: frontierTrainerSet.trainerId,
    })
    .from(frontierTrainerSet)
    .innerJoin(frontierSet, eq(frontierSet.id, frontierTrainerSet.setId))
    .where(
      and(
        inArray(
          frontierTrainerSet.trainerId,
          candidates.map((t) => t.id),
        ),
        pokemonId === undefined
          ? undefined
          : eq(frontierSet.pokemonId, pokemonId),
        // Level 50 mode never draws the high-tier sets.
        levelMode === "50" ? eq(frontierSet.openLevelOnly, false) : undefined,
      ),
    )
    .all();

  const bySet = new Map<number, number[]>();
  for (const { setId, trainerId: t } of links) {
    bySet.set(setId, [...(bySet.get(setId) ?? []), t]);
  }
  const ivOf = new Map(candidates.map((t) => [t.id, t.fixedIv]));
  return getSetDetails(db, [...bySet.keys()]).map((set) => {
    const trainerIds = bySet.get(set.id)!;
    return {
      ...set,
      trainerIds,
      possibleIvs: [...new Set(trainerIds.map((t) => ivOf.get(t)!))].sort(
        (a, b) => a - b,
      ),
    };
  });
}

export type PossibleSet = ReturnType<typeof getPossibleSets>[number];

/** A facility's Frontier Brain, schedule and fixed teams (none for the Factory). */
export function getFrontierBrain(db: Db, facility: FrontierFacility) {
  const brain = db
    .select()
    .from(frontierBrain)
    .where(eq(frontierBrain.facility, facility))
    .get();
  if (!brain) return null;
  const [m1, m2, m3, m4] = [1, 2, 3, 4].map((n) => alias(move, `m${n}`));
  const mons = db
    .select({
      symbol: frontierBrainMon.symbol,
      slot: frontierBrainMon.slot,
      pokemonId: frontierBrainMon.pokemonId,
      species: pokemon.name,
      item: item.name,
      nature: nature.name,
      fixedIv: frontierBrainMon.fixedIv,
      evHp: frontierBrainMon.evHp,
      evAttack: frontierBrainMon.evAttack,
      evDefense: frontierBrainMon.evDefense,
      evSpeed: frontierBrainMon.evSpeed,
      evSpAttack: frontierBrainMon.evSpAttack,
      evSpDefense: frontierBrainMon.evSpDefense,
      move1: m1!.name,
      move2: m2!.name,
      move3: m3!.name,
      move4: m4!.name,
    })
    .from(frontierBrainMon)
    .innerJoin(pokemon, eq(pokemon.id, frontierBrainMon.pokemonId))
    .innerJoin(nature, eq(nature.id, frontierBrainMon.natureId))
    .leftJoin(item, eq(item.id, frontierBrainMon.itemId))
    .leftJoin(m1!, eq(m1!.id, frontierBrainMon.move1Id))
    .leftJoin(m2!, eq(m2!.id, frontierBrainMon.move2Id))
    .leftJoin(m3!, eq(m3!.id, frontierBrainMon.move3Id))
    .leftJoin(m4!, eq(m4!.id, frontierBrainMon.move4Id))
    .where(eq(frontierBrainMon.facility, facility))
    .orderBy(asc(frontierBrainMon.symbol), asc(frontierBrainMon.slot))
    .all();
  const team = (symbol: "silver" | "gold") =>
    mons
      .filter((m) => m.symbol === symbol)
      .map(({ move1, move2, move3, move4, ...m }) => ({
        ...m,
        moves: [move1, move2, move3, move4].filter(
          (x): x is string => x !== null,
        ),
      }));
  return { ...brain, silver: team("silver"), gold: team("gold") };
}

/** National Dex number of Unown, which the Factory never gives opponents. */
const UNOWN = 201;

/**
 * The Battle Factory predictor: every set a regular opponent's Pokémon can be
 * at Factory battle `battle` (the Factory Head draws from the same pool).
 * The trainer doesn't matter in the Factory, only the streak and level mode.
 * The game also skips species among the player's current rentals, which
 * isn't known here.
 */
export function getFactorySets(
  db: Db,
  {
    battle,
    levelMode,
    pokemonId,
  }: { battle: number; levelMode: LevelMode; pokemonId?: number },
) {
  const position = battlePosition(battle);
  const range = db
    .select()
    .from(factorySetRange)
    .where(
      and(
        eq(factorySetRange.levelMode, levelMode),
        eq(factorySetRange.challenge, position.rangeChallenge),
      ),
    )
    .get();
  if (!range) throw new Error(`No Factory range for battle ${battle}`);
  const ids = db
    .select({ id: frontierSet.id })
    .from(frontierSet)
    .where(
      and(
        between(frontierSet.id, range.firstSetId, range.lastSetId),
        ne(frontierSet.pokemonId, UNOWN),
        pokemonId === undefined
          ? undefined
          : eq(frontierSet.pokemonId, pokemonId),
        levelMode === "50" ? eq(frontierSet.openLevelOnly, false) : undefined,
      ),
    )
    .all()
    .map((r) => r.id);
  return { ...position, sets: getSetDetails(db, ids) };
}

/** The Factory IV table, for factoryOpponentIv / factoryBrainIv in src/lib/frontier.ts. */
export function getFactoryIvTable(db: Db): FactoryIvRow[] {
  return db.select().from(factoryIv).orderBy(asc(factoryIv.challenge)).all();
}
