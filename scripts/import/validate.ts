/**
 * Checks the built database against facts we know from the games. Each
 * check is a query and an expected value; anything else fails the import.
 *
 * The first group guards against the classic mistakes of modern-generation
 * data sources (Fairy types, Gen 6+ stat buffs, later abilities).
 */
import type Database from "better-sqlite3";

type Check = { name: string; sql: string; expect: unknown };

const CHECKS: Check[] = [
  // Gen 3 accuracy (things modern data gets wrong)
  {
    name: "no Fairy type anywhere",
    sql: "SELECT count(*) FROM pokemon WHERE type1 = 'fairy' OR type2 = 'fairy'",
    expect: 0,
  },
  {
    name: "Marill is pure Water",
    sql: "SELECT type1 || '/' || ifnull(type2, '-') FROM pokemon WHERE name = 'Marill'",
    expect: "water/-",
  },
  {
    name: "Gardevoir is pure Psychic",
    sql: "SELECT type1 || '/' || ifnull(type2, '-') FROM pokemon WHERE name = 'Gardevoir'",
    expect: "psychic/-",
  },
  {
    name: "Mawile is pure Steel",
    sql: "SELECT type1 || '/' || ifnull(type2, '-') FROM pokemon WHERE name = 'Mawile'",
    expect: "steel/-",
  },
  {
    name: "Clefairy is Normal",
    sql: "SELECT type1 FROM pokemon WHERE name = 'Clefairy'",
    expect: "normal",
  },
  {
    name: "Gengar has Levitate only",
    sql: "SELECT a.name || '/' || ifnull(p.ability2_id, '-') FROM pokemon p JOIN ability a ON a.id = p.ability1_id WHERE p.name = 'Gengar'",
    expect: "Levitate/-",
  },
  {
    name: "Pikachu Sp. Def is 40 (50 from Gen 6)",
    sql: "SELECT sp_defense FROM pokemon WHERE name = 'Pikachu'",
    expect: 40,
  },
  {
    name: "Butterfree Sp. Atk is 80 (90 from Gen 6)",
    sql: "SELECT sp_attack FROM pokemon WHERE name = 'Butterfree'",
    expect: 80,
  },
  {
    name: "Alakazam Sp. Def is 85 (95 from Gen 6)",
    sql: "SELECT sp_defense FROM pokemon WHERE name = 'Alakazam'",
    expect: 85,
  },
  {
    name: "base friendship is 70 (Gen 8 changed many to 50)",
    sql: "SELECT base_friendship FROM pokemon WHERE name = 'Bulbasaur'",
    expect: 70,
  },

  // Counts
  { name: "386 Pokémon", sql: "SELECT count(*) FROM pokemon", expect: 386 },
  { name: "354 moves", sql: "SELECT count(*) FROM move", expect: 354 },
  {
    name: "202 Pokémon in the Hoenn Dex",
    sql: "SELECT count(*) FROM pokemon WHERE hoenn_dex_number IS NOT NULL",
    expect: 202,
  },
  { name: "25 natures", sql: "SELECT count(*) FROM nature", expect: 25 },
  { name: "58 TMs/HMs", sql: "SELECT count(*) FROM machine", expect: 58 },
  {
    name: "Pokédex text for every Pokémon in every game",
    sql: "SELECT count(*) FROM pokedex_text",
    expect: 386 * 5,
  },
  {
    name: "every Pokémon has level-up moves in every game",
    sql: "SELECT count(*) FROM (SELECT pokemon_id, game FROM learnset WHERE method = 'level' GROUP BY 1, 2)",
    expect: 386 * 5,
  },
  {
    name: "Ruby/Sapphire have no move tutors",
    sql: "SELECT count(*) FROM learnset WHERE method = 'tutor' AND game IN ('ruby', 'sapphire')",
    expect: 0,
  },
  {
    name: "every encounter table sums to 100%",
    sql: "SELECT count(*) FROM (SELECT sum(rate) s FROM encounter GROUP BY game, location_id, method) WHERE s <> 100",
    expect: 0,
  },
  {
    name: "every trainer has 1–6 Pokémon",
    sql: "SELECT count(*) FROM (SELECT count(*) c FROM trainer_mon GROUP BY trainer_id) WHERE c < 1 OR c > 6",
    expect: 0,
  },
  {
    name: "every trainer Pokémon knows a move",
    sql: "SELECT count(*) FROM trainer_mon WHERE move1_id IS NULL",
    expect: 0,
  },
  {
    name: "882 Frontier sets",
    sql: "SELECT count(*) FROM frontier_set",
    expect: 882,
  },
  {
    name: "300 Frontier trainers, each with sets",
    sql: "SELECT count(DISTINCT trainer_id) FROM frontier_trainer_set",
    expect: 300,
  },

  // Spot checks against the games
  {
    name: "Deoxys is Speed Forme in Emerald",
    sql: "SELECT form_name || ' ' || speed FROM base_stat_override WHERE game = 'emerald'",
    expect: "Speed Forme 180",
  },
  {
    name: "Deoxys is Attack Forme in FireRed",
    sql: "SELECT form_name || ' ' || attack FROM base_stat_override WHERE game = 'firered'",
    expect: "Attack Forme 180",
  },
  {
    name: "Fire is super effective on Grass",
    sql: "SELECT multiplier FROM type_chart WHERE attacking_type = 'fire' AND defending_type = 'grass'",
    expect: 2,
  },
  {
    name: "Normal can't hit Ghost",
    sql: "SELECT multiplier FROM type_chart WHERE attacking_type = 'normal' AND defending_type = 'ghost'",
    expect: 0,
  },
  {
    name: "TM26 is Earthquake",
    sql: "SELECT m.name FROM machine t JOIN move m ON m.id = t.move_id WHERE t.label = 'TM26'",
    expect: "Earthquake",
  },
  {
    name: "Emerald Route 101: Poochyena 45%",
    sql: `SELECT sum(e.rate) FROM encounter e JOIN location l ON l.id = e.location_id JOIN pokemon p ON p.id = e.pokemon_id
          WHERE e.game = 'emerald' AND l.key = 'MAP_ROUTE101' AND e.method = 'grass' AND p.name = 'Poochyena'`,
    expect: 45,
  },
  {
    name: "Ruby Route 101: Poochyena 10%",
    sql: `SELECT sum(e.rate) FROM encounter e JOIN location l ON l.id = e.location_id JOIN pokemon p ON p.id = e.pokemon_id
          WHERE e.game = 'ruby' AND l.key = 'MAP_ROUTE101' AND e.method = 'grass' AND p.name = 'Poochyena'`,
    expect: 10,
  },
  {
    name: "Emerald Roxanne's Nosepass: Lv 15 holding an Oran Berry",
    sql: `SELECT tm.level || ' ' || i.name FROM trainer t JOIN trainer_mon tm ON tm.trainer_id = t.id
          JOIN pokemon p ON p.id = tm.pokemon_id JOIN item i ON i.id = tm.held_item_id
          WHERE t.game = 'emerald' AND t.key = 'TRAINER_ROXANNE_1' AND p.name = 'Nosepass'`,
    expect: "15 Oran Berry",
  },
  {
    name: "FireRed Brock's Onix knows Rock Tomb",
    sql: `SELECT count(*) FROM trainer t JOIN trainer_mon tm ON tm.trainer_id = t.id JOIN pokemon p ON p.id = tm.pokemon_id
          JOIN move m ON m.id IN (tm.move1_id, tm.move2_id, tm.move3_id, tm.move4_id)
          WHERE t.game = 'firered' AND t.key = 'TRAINER_LEADER_BROCK' AND p.name = 'Onix' AND m.name = 'Rock Tomb'`,
    expect: 1,
  },
  {
    name: "Pikachu holds a Light Ball in R/S/E, nothing in FRLG",
    sql: `SELECT group_concat(version_group) FROM (SELECT version_group FROM wild_held_item w JOIN item i ON i.id = w.item_id
          WHERE w.pokemon_id = 25 AND i.name = 'Light Ball' ORDER BY version_group)`,
    expect: "e,rs",
  },
];

export function validate(db: Database.Database): string[] {
  const failures: string[] = [];
  for (const check of CHECKS) {
    const actual = db.prepare(check.sql).pluck().get();
    if (actual !== check.expect)
      failures.push(
        `${check.name}: expected ${String(check.expect)}, got ${String(actual)}`,
      );
    else console.log(`  ✓ ${check.name}`);
  }

  const counts = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite%' ORDER BY name",
    )
    .pluck()
    .all() as string[];
  console.log(
    "\n  Rows: " +
      counts
        .map(
          (t) =>
            `${t} ${db.prepare(`SELECT count(*) FROM "${t}"`).pluck().get() as number}`,
        )
        .join(", "),
  );
  return failures;
}
