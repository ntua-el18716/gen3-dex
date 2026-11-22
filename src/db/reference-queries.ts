import { and, asc, eq, or } from "drizzle-orm";

import { GAME_INFO } from "@/lib/games";

import type { Db } from "./queries";
import {
  ability,
  evolution,
  item,
  learnset,
  LEARN_METHODS,
  machine,
  move,
  pokemon,
  wildHeldItem,
  type Game,
  type LearnMethod,
} from "./schema";

const mon = {
  pokemonId: pokemon.id,
  name: pokemon.name,
  type1: pokemon.type1,
  type2: pokemon.type2,
};

/**
 * A move, with the TM/HM that teaches it and every Pokémon that learns it in
 * one game, per learn method. Egg moves are also listed under the Pokémon's
 * later stages (with `from`), as on the Pokémon page: the games list them
 * under the first stage only, but it keeps them when it evolves.
 */
export function getMove(db: Db, id: number, game: Game) {
  const row = db.select().from(move).where(eq(move.id, id)).get();
  if (!row) return null;
  const tm = db
    .select({ label: machine.label })
    .from(machine)
    .where(eq(machine.moveId, id))
    .get();
  const rows = db
    .select({ ...mon, method: learnset.method, level: learnset.level })
    .from(learnset)
    .innerJoin(pokemon, eq(pokemon.id, learnset.pokemonId))
    .where(and(eq(learnset.moveId, id), eq(learnset.game, game)))
    .orderBy(asc(learnset.level), asc(pokemon.id))
    .all();

  type Learner = (typeof rows)[number] & { from: string | null };
  const sections = LEARN_METHODS.map((method) => {
    const learners: Learner[] = [];
    for (const r of rows.filter((r) => r.method === method)) {
      // A move learned at several levels shows once, at the first.
      if (!learners.some((l) => l.pokemonId === r.pokemonId))
        learners.push({ ...r, from: null });
    }
    if (method === "egg") {
      const steps = db
        .select({ from: evolution.fromPokemonId, to: evolution.toPokemonId })
        .from(evolution)
        .all();
      for (let i = 0; i < learners.length; i++) {
        const parent = learners[i]!;
        for (const step of steps.filter((s) => s.from === parent.pokemonId)) {
          if (learners.some((l) => l.pokemonId === step.to)) continue;
          const child = db
            .select(mon)
            .from(pokemon)
            .where(eq(pokemon.id, step.to))
            .get();
          if (child)
            learners.push({
              ...child,
              method,
              level: 0,
              from: parent.from ?? parent.name,
            });
        }
      }
    }
    const byOrder = (a: Learner, b: Learner) =>
      method === "level"
        ? a.level - b.level || a.pokemonId - b.pokemonId
        : a.pokemonId - b.pokemonId;
    return { method: method as LearnMethod, learners: learners.sort(byOrder) };
  }).filter((s) => s.learners.length > 0);

  return { ...row, machine: tm?.label ?? null, sections };
}

/**
 * An ability and every Pokémon that can have it (Gen 3: one or two per
 * species), with the species' other ability if it has two.
 */
export function getAbility(db: Db, id: number) {
  const row = db.select().from(ability).where(eq(ability.id, id)).get();
  if (!row) return null;
  const names = new Map(
    db
      .select({ id: ability.id, name: ability.name })
      .from(ability)
      .all()
      .map((a) => [a.id, a.name]),
  );
  const pokemonRows = db
    .select({
      ...mon,
      ability1Id: pokemon.ability1Id,
      ability2Id: pokemon.ability2Id,
    })
    .from(pokemon)
    .where(or(eq(pokemon.ability1Id, id), eq(pokemon.ability2Id, id)))
    .orderBy(asc(pokemon.id))
    .all()
    .map(({ ability1Id, ability2Id, ...p }) => {
      const otherId = ability1Id === id ? ability2Id : ability1Id;
      return {
        ...p,
        /** The species' other ability, or null if this is its only one. */
        other:
          otherId !== null && otherId !== id
            ? (names.get(otherId) ?? null)
            : null,
      };
    });
  return { ...row, pokemon: pokemonRows };
}

/**
 * An item: the move it teaches if it's a TM/HM, and the wild Pokémon that
 * may hold it in the game's version group (common 50%, rare 5%).
 */
export function getItem(db: Db, id: number, game: Game) {
  const row = db.select().from(item).where(eq(item.id, id)).get();
  if (!row) return null;
  const teaches =
    row.pocket === "tms-hms"
      ? (db
          .select({ id: move.id, name: move.name, type: move.type })
          .from(machine)
          .innerJoin(move, eq(move.id, machine.moveId))
          .where(eq(machine.label, row.name))
          .get() ?? null)
      : null;
  const heldBy = db
    .select({ ...mon, rarity: wildHeldItem.rarity })
    .from(wildHeldItem)
    .innerJoin(pokemon, eq(pokemon.id, wildHeldItem.pokemonId))
    .where(
      and(
        eq(wildHeldItem.itemId, id),
        eq(wildHeldItem.versionGroup, GAME_INFO[game].versionGroup),
      ),
    )
    .orderBy(asc(pokemon.id))
    .all();
  return { ...row, teaches, heldBy };
}

export type MoveDetail = NonNullable<ReturnType<typeof getMove>>;
export type AbilityDetail = NonNullable<ReturnType<typeof getAbility>>;
export type ItemDetail = NonNullable<ReturnType<typeof getItem>>;

/** Every move, ability and item by name, for the reference index. */
export function listReference(db: Db) {
  return {
    moves: db
      .select({
        id: move.id,
        name: move.name,
        type: move.type,
        power: move.power,
      })
      .from(move)
      .orderBy(asc(move.name))
      .all(),
    abilities: db
      .select({
        id: ability.id,
        name: ability.name,
        description: ability.description,
      })
      .from(ability)
      .orderBy(asc(ability.name))
      .all()
      // pret's ABILITY_NONE placeholder ("-------").
      .filter((a) => /\w/.test(a.name)),
    items: db
      .select({ id: item.id, name: item.name, pocket: item.pocket })
      .from(item)
      .orderBy(asc(item.name))
      .all()
      .filter((i) => i.pocket !== null && /\w/.test(i.name)),
  };
}
