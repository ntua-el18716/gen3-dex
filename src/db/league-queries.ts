import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { RIVAL_STARTER } from "@/lib/league";

import type { Db } from "./queries";
import {
  item,
  move,
  pokemon,
  trainer,
  trainerMon,
  type Game,
  type PokemonType,
} from "./schema";

/**
 * The trainers with the given keys in one game, each with their team
 * (species, types, level, held item, moves), keyed by trainer key. Keys the
 * game doesn't have are missing from the result.
 */
export function getTrainerTeams(db: Db, game: Game, keys: string[]) {
  if (keys.length === 0) return new Map<string, TrainerTeam>();
  const trainers = db
    .select()
    .from(trainer)
    .where(and(eq(trainer.game, game), inArray(trainer.key, keys)))
    .all();
  const [m1, m2, m3, m4] = [1, 2, 3, 4].map((n) => alias(move, `m${n}`));
  const mons = db
    .select({
      trainerId: trainerMon.trainerId,
      slot: trainerMon.slot,
      pokemonId: trainerMon.pokemonId,
      name: pokemon.name,
      type1: pokemon.type1,
      type2: pokemon.type2,
      level: trainerMon.level,
      iv: trainerMon.iv,
      item: item.name,
      itemId: trainerMon.heldItemId,
      movesComputed: trainerMon.movesComputed,
      move1: m1!.name,
      move2: m2!.name,
      move3: m3!.name,
      move4: m4!.name,
      moveType1: m1!.type,
      moveType2: m2!.type,
      moveType3: m3!.type,
      moveType4: m4!.type,
      moveId1: trainerMon.move1Id,
      moveId2: trainerMon.move2Id,
      moveId3: trainerMon.move3Id,
      moveId4: trainerMon.move4Id,
    })
    .from(trainerMon)
    .innerJoin(pokemon, eq(pokemon.id, trainerMon.pokemonId))
    .leftJoin(item, eq(item.id, trainerMon.heldItemId))
    .leftJoin(m1!, eq(m1!.id, trainerMon.move1Id))
    .leftJoin(m2!, eq(m2!.id, trainerMon.move2Id))
    .leftJoin(m3!, eq(m3!.id, trainerMon.move3Id))
    .leftJoin(m4!, eq(m4!.id, trainerMon.move4Id))
    .where(
      inArray(
        trainerMon.trainerId,
        trainers.map((t) => t.id),
      ),
    )
    .orderBy(asc(trainerMon.slot))
    .all();

  return new Map(
    trainers.map((t) => [
      t.key,
      {
        key: t.key,
        // FR/LG's rival is named by the player; the data has a placeholder.
        // And the games' text has "Tate&liza"; show it as people write it.
        name:
          t.name === "Terry"
            ? "Your rival"
            : t.name.replace(
                /&(\w)/,
                (_, c: string) => ` & ${c.toUpperCase()}`,
              ),
        trainerClass: t.trainerClass,
        isDouble: t.isDouble,
        team: mons
          .filter((m) => m.trainerId === t.id)
          .map(
            ({
              move1,
              move2,
              move3,
              move4,
              moveType1,
              moveType2,
              moveType3,
              moveType4,
              moveId1,
              moveId2,
              moveId3,
              moveId4,
              trainerId: _,
              ...m
            }) => ({
              ...m,
              moves: [move1, move2, move3, move4].filter(
                (x): x is string => x !== null,
              ),
              moveTypes: [moveType1, moveType2, moveType3, moveType4].filter(
                (t): t is PokemonType => t !== null,
              ),
              moveIds: [moveId1, moveId2, moveId3, moveId4].filter(
                (x): x is number => x !== null,
              ),
            }),
          ),
      },
    ]),
  );
}

export type TrainerTeam = {
  key: string;
  name: string;
  trainerClass: string;
  isDouble: boolean;
  team: {
    slot: number;
    pokemonId: number;
    name: string;
    type1: (typeof pokemon.$inferSelect)["type1"];
    type2: (typeof pokemon.$inferSelect)["type2"];
    level: number;
    iv: number;
    item: string | null;
    itemId: number | null;
    movesComputed: boolean;
    moves: string[];
    /** Each move's type, in the same order as `moves`. */
    moveTypes: PokemonType[];
    /** Each move's id, in the same order as `moves`. */
    moveIds: number[];
  }[];
};

/** Evolution lines of the starters, by first stage. */
const STARTER_LINES: Record<number, number[]> = {
  1: [1, 2, 3],
  4: [4, 5, 6],
  7: [7, 8, 9],
  252: [252, 253, 254],
  255: [255, 256, 257],
  258: [258, 259, 260],
};

/**
 * Of a rival battle's teams (one per starter), the one you face if you
 * picked `yourStarter`: the team with the rival's starter line in it.
 */
export function pickForStarter(
  teams: TrainerTeam[],
  yourStarter: number,
): TrainerTeam | undefined {
  if (teams.length <= 1) return teams[0];
  const line = STARTER_LINES[RIVAL_STARTER[yourStarter] ?? -1] ?? [];
  return teams.find((t) => t.team.some((m) => line.includes(m.pokemonId)));
}
